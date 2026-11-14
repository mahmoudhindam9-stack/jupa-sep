-- =============================================================================
-- Migration: Default Temporary Password (admin@123456) & First-Login Reset Flow
-- 1. Marks new managed accounts created with the default password (admin@123456)
--    as requiring a password change on first login (must_change_password = true).
-- 2. Adds public.complete_own_password_reset(p_new_password text) so any
--    authenticated user can complete their mandatory password reset and clear
--    the must_change_password metadata flag in auth.users.
-- =============================================================================
BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- 1. Update create_managed_user_account to tag accounts created with admin@123456
CREATE OR REPLACE FUNCTION public.create_managed_user_account(
  p_email text,
  p_password text,
  p_username text,
  p_full_name text,
  p_phone text,
  p_role text,
  p_permissions jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $create_managed_user$
DECLARE
  v_new_user_id uuid := gen_random_uuid();
  v_email text := lower(trim(COALESCE(p_email, '')));
  v_username text := lower(trim(COALESCE(p_username, '')));
  v_full_name text := trim(COALESCE(p_full_name, ''));
  v_phone text := trim(COALESCE(p_phone, ''));
  v_role text := lower(trim(COALESCE(p_role, 'cashier')));
  v_password text := COALESCE(p_password, 'Admin@123456');
  v_must_change boolean := (lower(trim(v_password)) = 'admin@123456');
  v_instance_id uuid;
  v_profile jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT public.current_user_can_manage_profiles() THEN
    RAISE EXCEPTION 'NOT_AUTHORIZED: you do not have permission to manage Users and permissions.';
  END IF;

  IF NULLIF(v_email, '') IS NULL
     OR length(v_email) > 254
     OR v_email !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]{2,}$' THEN
    RAISE EXCEPTION 'EMAIL_INVALID: a valid email address is required.';
  END IF;

  IF length(v_password) < 8 THEN
    RAISE EXCEPTION 'WEAK_PASSWORD: password must be at least 8 characters.';
  END IF;

  IF EXISTS (SELECT 1 FROM auth.users u WHERE lower(trim(u.email)) = v_email)
     OR EXISTS (SELECT 1 FROM public.profiles p WHERE lower(trim(COALESCE(p.email, ''))) = v_email) THEN
    RAISE EXCEPTION 'EMAIL_ALREADY_EXISTS: this email already belongs to another account.';
  END IF;

  IF EXISTS (SELECT 1 FROM public.profiles p WHERE lower(trim(COALESCE(p.username, ''))) = v_username) THEN
    RAISE EXCEPTION 'USERNAME_ALREADY_EXISTS: choose a different username.';
  END IF;

  SELECT COALESCE(
    (SELECT u.instance_id FROM auth.users u LIMIT 1),
    '00000000-0000-0000-0000-000000000000'::uuid
  ) INTO v_instance_id;

  INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    email_change,
    email_change_token_new,
    recovery_token
  )
  VALUES (
    v_instance_id,
    v_new_user_id,
    'authenticated',
    'authenticated',
    v_email,
    extensions.crypt(v_password, extensions.gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object(
      'username', v_username,
      'full_name', v_full_name,
      'phone', v_phone,
      'role', v_role,
      'must_change_password', v_must_change
    ),
    now(),
    now(),
    '',
    '',
    '',
    ''
  );

  INSERT INTO auth.identities (
    id,
    user_id,
    provider_id,
    identity_data,
    provider,
    last_sign_in_at,
    created_at,
    updated_at
  )
  VALUES (
    gen_random_uuid(),
    v_new_user_id,
    v_new_user_id::text,
    jsonb_build_object(
      'sub', v_new_user_id::text,
      'email', v_email,
      'email_verified', true,
      'phone_verified', false
    ),
    'email',
    now(),
    now(),
    now()
  );

  v_profile := public.upsert_managed_user_profile(
    v_new_user_id,
    v_username,
    v_full_name,
    v_phone,
    v_role,
    p_permissions
  );

  RETURN v_profile;
END;
$create_managed_user$;

REVOKE ALL ON FUNCTION public.create_managed_user_account(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_managed_user_account(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB)
  TO authenticated;

-- 2. Update update_managed_user_password to maintain must_change_password flag
CREATE OR REPLACE FUNCTION public.update_managed_user_password(
  p_user_id uuid,
  p_new_password text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $update_managed_password$
DECLARE
  v_actor_permissions jsonb;
  v_target_role text;
  v_target_permissions jsonb;
  v_must_change boolean := (lower(trim(COALESCE(p_new_password, ''))) = 'admin@123456');
BEGIN
  IF auth.uid() IS NULL OR NOT public.current_user_can_manage_profiles() THEN
    RAISE EXCEPTION 'NOT_AUTHORIZED: you do not have permission to manage Users and permissions.';
  END IF;

  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'USER_ID_INVALID: a valid Supabase Auth UUID is required.';
  END IF;

  IF length(COALESCE(p_new_password, '')) < 8 THEN
    RAISE EXCEPTION 'WEAK_PASSWORD: password must be at least 8 characters.';
  END IF;

  SELECT COALESCE(p.permissions, '{}'::jsonb)
    INTO v_actor_permissions
    FROM public.profiles p
   WHERE p.id = auth.uid();

  SELECT p.role, COALESCE(p.permissions, '{}'::jsonb)
    INTO v_target_role, v_target_permissions
    FROM public.profiles p
   WHERE p.id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'AUTH_USER_NOT_FOUND: the matching profile does not exist.';
  END IF;

  IF COALESCE(v_actor_permissions ->> 'super_admin_full_access', 'false') <> 'true'
     AND (
       v_target_role IN ('admin', 'super_admin')
       OR COALESCE(v_target_permissions ->> 'super_admin_full_access', 'false') = 'true'
     ) THEN
    RAISE EXCEPTION 'NOT_AUTHORIZED: only a super administrator can change an administrator password.';
  END IF;

  UPDATE auth.users
     SET encrypted_password = extensions.crypt(p_new_password, extensions.gen_salt('bf')),
         raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object(
           'must_change_password', v_must_change
         ),
         updated_at = now()
   WHERE id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'AUTH_USER_NOT_FOUND: the matching Supabase Auth account does not exist.';
  END IF;

  RETURN true;
END;
$update_managed_password$;

REVOKE ALL ON FUNCTION public.update_managed_user_password(UUID, TEXT)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_managed_user_password(UUID, TEXT)
  TO authenticated;

-- 3. Self-service RPC for any authenticated user completing their password & personal email reset
DROP FUNCTION IF EXISTS public.complete_own_password_reset(TEXT);
CREATE OR REPLACE FUNCTION public.complete_own_password_reset(
  p_new_password text,
  p_new_email text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $complete_own_password_reset$
DECLARE
  v_pwd text := COALESCE(p_new_password, '');
  v_email text := lower(trim(COALESCE(p_new_email, '')));
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHORIZED: an authenticated session is required.';
  END IF;

  IF length(v_pwd) < 8 OR length(v_pwd) > 128 THEN
    RAISE EXCEPTION 'WEAK_PASSWORD: password must be between 8 and 128 characters.';
  END IF;

  IF v_pwd !~ '[A-Za-z]' OR v_pwd !~ '[0-9]' OR v_pwd ~ '[[:space:]]' THEN
    RAISE EXCEPTION 'WEAK_PASSWORD: password must contain English letters and digits without spaces.';
  END IF;

  IF lower(trim(v_pwd)) = 'admin@123456' THEN
    RAISE EXCEPTION 'WEAK_PASSWORD: new password cannot be the default temporary password.';
  END IF;

  IF v_email <> '' THEN
    IF length(v_email) > 254 OR v_email !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]{2,}$' THEN
      RAISE EXCEPTION 'EMAIL_INVALID: a valid personal email address is required.';
    END IF;

    IF EXISTS (
      SELECT 1 FROM auth.users u
      WHERE lower(trim(u.email)) = v_email AND u.id <> auth.uid()
    ) OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE lower(trim(COALESCE(p.email, ''))) = v_email AND p.id <> auth.uid()
    ) THEN
      RAISE EXCEPTION 'EMAIL_ALREADY_EXISTS: this email already belongs to another account.';
    END IF;
  END IF;

  UPDATE auth.users
     SET encrypted_password = extensions.crypt(v_pwd, extensions.gen_salt('bf')),
         email = CASE WHEN v_email <> '' THEN v_email ELSE email END,
         email_confirmed_at = COALESCE(email_confirmed_at, now()),
         raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object(
           'must_change_password', false,
           'password_changed_at', to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
         ),
         updated_at = now()
   WHERE id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'AUTH_USER_NOT_FOUND: authenticated user account not found.';
  END IF;

  IF v_email <> '' THEN
    UPDATE public.profiles
       SET email = v_email,
           updated_at = now()
     WHERE id = auth.uid();
  END IF;

  RETURN true;
END;
$complete_own_password_reset$;

REVOKE ALL ON FUNCTION public.complete_own_password_reset(TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.complete_own_password_reset(TEXT, TEXT) TO authenticated;

COMMIT;
