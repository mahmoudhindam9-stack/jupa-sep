-- Enforce one user-input contract in the browser and Supabase.
-- Existing managed accounts are preserved; invalid new profile writes are rejected with actionable errors.
BEGIN;

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
  v_full_name text := trim(COALESCE(p_full_name, ''));
  v_phone text := trim(COALESCE(p_phone, ''));
  v_role text := lower(trim(COALESCE(p_role, '')));
  v_permissions jsonb := COALESCE(p_permissions, '{}'::jsonb);
  v_profile jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT public.current_user_can_manage_profiles() THEN
    RAISE EXCEPTION USING ERRCODE = '42501',
      MESSAGE = 'NOT_AUTHORIZED: لا يملك حسابك صلاحية إدارة المستخدمين.';
  END IF;

  IF p_user_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '22023',
      MESSAGE = 'USER_ID_REQUIRED: معرّف حساب Supabase مطلوب.';
  END IF;

  IF v_username !~ '^[a-z0-9._-]{3,32}$' THEN
    RAISE EXCEPTION USING ERRCODE = '22023',
      MESSAGE = 'INVALID_USERNAME: اسم المستخدم يجب أن يكون من 3 إلى 32 حرفًا إنجليزيًا صغيرًا أو رقمًا أو نقطة أو شرطة.';
  END IF;

  IF v_full_name = '' THEN
    RAISE EXCEPTION USING ERRCODE = '22023',
      MESSAGE = 'FULL_NAME_REQUIRED: الاسم الكامل مطلوب.';
  END IF;
  IF char_length(v_full_name) > 120 THEN
    RAISE EXCEPTION USING ERRCODE = '22023',
      MESSAGE = 'FULL_NAME_TOO_LONG: الاسم الكامل لا يمكن أن يتجاوز 120 حرفًا.';
  END IF;
  IF char_length(v_phone) > 40 THEN
    RAISE EXCEPTION USING ERRCODE = '22023',
      MESSAGE = 'PHONE_TOO_LONG: رقم الهاتف لا يمكن أن يتجاوز 40 حرفًا.';
  END IF;

  IF v_role NOT IN ('admin', 'super_admin', 'manager', 'cashier', 'captain', 'kitchen') THEN
    RAISE EXCEPTION USING ERRCODE = '22023',
      MESSAGE = 'INVALID_ROLE: الدور الوظيفي غير معتمد في قاعدة البيانات.';
  END IF;

  IF jsonb_typeof(v_permissions) <> 'object' THEN
    RAISE EXCEPTION USING ERRCODE = '22023',
      MESSAGE = 'INVALID_PERMISSIONS: الصلاحيات يجب أن تكون كائن JSON.';
  END IF;
  IF EXISTS (
    SELECT 1
      FROM jsonb_each(v_permissions) AS entry(key, value)
     WHERE jsonb_typeof(entry.value) <> 'boolean'
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '22023',
      MESSAGE = 'INVALID_PERMISSIONS: كل صلاحية يجب أن تكون true أو false.';
  END IF;

  SELECT lower(trim(u.email))
    INTO v_email
    FROM auth.users AS u
   WHERE u.id = p_user_id;

  IF NOT FOUND OR v_email IS NULL OR
     v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]{2,}$' THEN
    RAISE EXCEPTION USING ERRCODE = '22023',
      MESSAGE = 'INVALID_EMAIL: لا يوجد بريد إلكتروني صالح مرتبط بحساب Supabase Auth.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE lower(p.username) = v_username AND p.id <> p_user_id
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '23505',
      MESSAGE = 'USERNAME_ALREADY_EXISTS: اسم المستخدم مستخدم بالفعل. اختر اسمًا آخر.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE lower(trim(p.email)) = v_email AND p.id <> p_user_id
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '23505',
      MESSAGE = 'EMAIL_ALREADY_EXISTS: البريد الإلكتروني مرتبط بملف مستخدم آخر.';
  END IF;

  INSERT INTO public.profiles AS target (
    id, email, username, full_name, phone, role, permissions, created_at, updated_at
  )
  VALUES (
    p_user_id,
    v_email,
    v_username,
    v_full_name,
    NULLIF(v_phone, ''),
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

-- Validate Auth signups too, including direct client attempts that bypass the UI.
-- The app sends these fields for both the first administrator and managed new accounts.
CREATE OR REPLACE FUNCTION public.validate_managed_auth_signup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $validate_managed_auth_signup$
DECLARE
  v_email text := lower(trim(COALESCE(NEW.email, '')));
  v_username text := lower(trim(COALESCE(
    NEW.raw_user_meta_data ->> 'username',
    split_part(COALESCE(NEW.email, ''), '@', 1)
  )));
  v_full_name text := trim(COALESCE(NEW.raw_user_meta_data ->> 'full_name', ''));
  v_phone text := trim(COALESCE(NEW.raw_user_meta_data ->> 'phone', ''));
  v_role text := lower(trim(COALESCE(NEW.raw_user_meta_data ->> 'role', 'cashier')));
BEGIN
  IF v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]{2,}$' THEN
    RAISE EXCEPTION USING ERRCODE = '22023',
      MESSAGE = 'INVALID_EMAIL: أدخل بريدًا إلكترونيًا صالحًا.';
  END IF;

  IF v_username !~ '^[a-z0-9._-]{3,32}$' THEN
    RAISE EXCEPTION USING ERRCODE = '22023',
      MESSAGE = 'INVALID_USERNAME: اسم المستخدم يجب أن يكون من 3 إلى 32 حرفًا إنجليزيًا صغيرًا أو رقمًا أو نقطة أو شرطة.';
  END IF;

  IF v_full_name = '' THEN
    RAISE EXCEPTION USING ERRCODE = '22023',
      MESSAGE = 'FULL_NAME_REQUIRED: الاسم الكامل مطلوب.';
  END IF;
  IF char_length(v_full_name) > 120 THEN
    RAISE EXCEPTION USING ERRCODE = '22023',
      MESSAGE = 'FULL_NAME_TOO_LONG: الاسم الكامل لا يمكن أن يتجاوز 120 حرفًا.';
  END IF;
  IF char_length(v_phone) > 40 THEN
    RAISE EXCEPTION USING ERRCODE = '22023',
      MESSAGE = 'PHONE_TOO_LONG: رقم الهاتف لا يمكن أن يتجاوز 40 حرفًا.';
  END IF;

  IF v_role NOT IN ('admin', 'super_admin', 'manager', 'cashier', 'captain', 'kitchen') THEN
    RAISE EXCEPTION USING ERRCODE = '22023',
      MESSAGE = 'INVALID_ROLE: الدور الوظيفي غير معتمد.';
  END IF;

  RETURN NEW;
END;
$validate_managed_auth_signup$;

REVOKE ALL ON FUNCTION public.validate_managed_auth_signup() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS validate_managed_auth_signup_before_insert ON auth.users;
CREATE TRIGGER validate_managed_auth_signup_before_insert
  BEFORE INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.validate_managed_auth_signup();

COMMIT;
