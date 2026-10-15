-- Unify the Users page with Supabase Auth + public.profiles.
-- Safe forward-only migration: preserves existing Auth users and profile rows.
BEGIN;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email text;

-- Backfill each managed profile with the authoritative email held by Supabase Auth.
UPDATE public.profiles AS p
   SET email = lower(trim(u.email)),
       updated_at = now()
  FROM auth.users AS u
 WHERE u.id = p.id
   AND NULLIF(trim(u.email), '') IS NOT NULL
   AND p.email IS DISTINCT FROM lower(trim(u.email));

-- The browser must not directly upsert user ACLs and then report success regardless
-- of server-side RLS/trigger errors. All managed profile writes go through this RPC.
CREATE OR REPLACE FUNCTION public.upsert_managed_user_profile(
  p_user_id uuid,
  p_username text,
  p_full_name text,
  p_phone text,
  p_role text,
  p_permissions jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $managed_profile$
DECLARE
  v_email text;
  v_username text := lower(trim(COALESCE(p_username, '')));
  v_role text := lower(trim(COALESCE(p_role, 'cashier')));
  v_permissions jsonb := COALESCE(p_permissions, '{}'::jsonb);
  v_profile jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT public.current_user_can_manage_profiles() THEN
    RAISE EXCEPTION 'NOT_AUTHORIZED: you do not have permission to manage Users and permissions.';
  END IF;

  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'USER_ID_REQUIRED: a Supabase Auth user ID is required.';
  END IF;

  IF v_username = '' OR length(v_username) > 100 OR v_username ~ '[[:space:]]' THEN
    RAISE EXCEPTION 'INVALID_USERNAME: username must be non-empty and contain no whitespace.';
  END IF;

  IF NULLIF(trim(COALESCE(p_full_name, '')), '') IS NULL THEN
    RAISE EXCEPTION 'FULL_NAME_REQUIRED: enter the user full name.';
  END IF;

  IF v_role NOT IN ('admin', 'super_admin', 'manager', 'cashier', 'captain', 'kitchen') THEN
    RAISE EXCEPTION 'INVALID_ROLE: unsupported user role.';
  END IF;

  IF jsonb_typeof(v_permissions) <> 'object' THEN
    RAISE EXCEPTION 'INVALID_PERMISSIONS: permissions must be a JSON object.';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM jsonb_each(v_permissions) AS entry(key, value)
     WHERE jsonb_typeof(entry.value) <> 'boolean'
  ) THEN
    RAISE EXCEPTION 'INVALID_PERMISSIONS: every permission value must be boolean.';
  END IF;

  SELECT lower(trim(u.email))
    INTO v_email
    FROM auth.users AS u
   WHERE u.id = p_user_id;

  IF NOT FOUND OR NULLIF(v_email, '') IS NULL THEN
    RAISE EXCEPTION 'AUTH_USER_NOT_FOUND: the matching Supabase Auth account does not exist.';
  END IF;

  INSERT INTO public.profiles AS target (
    id, email, username, full_name, phone, role, permissions, created_at, updated_at
  )
  VALUES (
    p_user_id,
    v_email,
    v_username,
    trim(p_full_name),
    NULLIF(trim(COALESCE(p_phone, '')), ''),
    v_role,
    v_permissions,
    now(),
    now()
  )
  ON CONFLICT (id) DO UPDATE
     SET email = EXCLUDED.email,
         username = EXCLUDED.username,
         full_name = EXCLUDED.full_name,
         phone = EXCLUDED.phone,
         role = EXCLUDED.role,
         permissions = EXCLUDED.permissions,
         updated_at = now()
  RETURNING to_jsonb(target) INTO v_profile;

  RETURN v_profile;
END;
$managed_profile$;

REVOKE ALL ON FUNCTION public.upsert_managed_user_profile(UUID, TEXT, TEXT, TEXT, TEXT, JSONB)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.upsert_managed_user_profile(UUID, TEXT, TEXT, TEXT, TEXT, JSONB)
  TO authenticated;

-- Notify connected Users pages when an authorized session changes a profile.
DO $profiles_realtime$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime'
  ) AND NOT EXISTS (
    SELECT 1
      FROM pg_publication_tables
     WHERE pubname = 'supabase_realtime'
       AND schemaname = 'public'
       AND tablename = 'profiles'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles';
  END IF;
END;
$profiles_realtime$;

COMMIT;
