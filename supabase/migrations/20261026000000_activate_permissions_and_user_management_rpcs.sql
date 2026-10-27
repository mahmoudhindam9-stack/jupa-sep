-- Activate full RBAC permissions synchronization and server-side managed user creation/password RPCs.
BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- 1. Server-side RPC to create a managed user account + Auth identity + profile atomically
-- Works even when GoTrue public signups are disabled (disable_signup = true).
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
  v_password text := COALESCE(p_password, '');
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
      'role', v_role
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

-- 2. Server-side RPC for authorized user managers to update a managed user's password
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

-- 3. Helper RPC to fetch the currently authenticated user's profile and permissions
CREATE OR REPLACE FUNCTION public.get_my_managed_profile()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $get_my_profile$
  SELECT to_jsonb(p)
  FROM public.profiles p
  WHERE p.id = auth.uid()
  LIMIT 1;
$get_my_profile$;

REVOKE ALL ON FUNCTION public.get_my_managed_profile() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_managed_profile() TO authenticated;

COMMIT;
