-- One-time user-directory reset requested for the clean Supabase bootstrap.
-- This is intentionally destructive: it deletes every existing Auth account and profile.
-- Operational tables are not truncated. Only the first Auth identity, when it is the
-- only Auth user and the profile directory is empty, receives administrator access.
BEGIN;

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email text;

-- Keep the SQL role constraint aligned with the roles supported by the Users page.
-- Previous migrations only allowed a subset and caused legitimate role saves to fail.
DO $$
DECLARE
  role_constraint record;
BEGIN
  FOR role_constraint IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.profiles'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%role%'
  LOOP
    EXECUTE format('ALTER TABLE public.profiles DROP CONSTRAINT %I', role_constraint.conname);
  END LOOP;
END;
$$;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_allowed_check
  CHECK (role IN ('admin', 'super_admin', 'manager', 'cashier', 'captain', 'kitchen'));

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_created_almokhtar_profile ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_created_initial_admin ON auth.users;

-- Clear old login accounts and profile rows. Auth cascades remove credentials/sessions/identities.
DELETE FROM public.profiles;
DELETE FROM auth.users;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_email_lower_uidx
  ON public.profiles (lower(email))
  WHERE email IS NOT NULL AND trim(email) <> '';

CREATE OR REPLACE FUNCTION public.is_initial_admin_setup_available()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NOT EXISTS (SELECT 1 FROM public.profiles)
     AND NOT EXISTS (SELECT 1 FROM auth.users);
$$;

REVOKE ALL ON FUNCTION public.is_initial_admin_setup_available() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_initial_admin_setup_available() TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.bootstrap_first_admin_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  initial_permissions jsonb;
  normalized_email text;
  normalized_username text;
BEGIN
  -- Serialize concurrent signups before checking the one-time bootstrap condition.
  PERFORM pg_advisory_xact_lock(hashtext('jupa-sep-initial-admin-bootstrap'), 0);

  -- Do not promote a signup if any managed profile or any other Auth identity exists.
  -- Checking Auth as well as profiles prevents an orphaned legacy Auth identity from
  -- accidentally allowing a later public signup to receive administrator privileges.
  IF EXISTS (SELECT 1 FROM public.profiles)
     OR EXISTS (SELECT 1 FROM auth.users WHERE id <> NEW.id) THEN
    RETURN NEW;
  END IF;

  normalized_email := lower(trim(COALESCE(NEW.email, '')));
  normalized_username := lower(trim(COALESCE(
    NULLIF(NEW.raw_user_meta_data ->> 'username', ''),
    NULLIF(split_part(normalized_email, '@', 1), ''),
    'admin'
  )));

  SELECT jsonb_object_agg(permission_key, true)
    INTO initial_permissions
  FROM unnest(ARRAY[
    'orders', 'orders_view', 'orders_create_custom', 'orders_cancel_modify',
    'orders_manage_carts', 'orders_generate_qr', 'pos', 'pos_access',
    'pos_create_custom_order', 'pos_apply_discounts', 'pos_void_items',
    'captain', 'captain_access', 'captain_create_order', 'captain_transfer_tables',
    'captain_modify_items', 'kitchen', 'kitchen_view', 'kitchen_change_status',
    'kitchen_modify_order', 'delivery', 'delivery_view', 'delivery_update_status',
    'inventory', 'inventory_view', 'inventory_adjust_transfer', 'inventory_waste_dispose',
    'purchasing', 'purchasing_view', 'purchasing_add_invoice', 'purchasing_returns',
    'production', 'production_view', 'production_execute', 'hr', 'hr_view_attendance',
    'hr_manage_payroll_loans', 'treasury', 'treasury_view', 'treasury_open_close',
    'treasury_transfer_reconcile', 'accounting', 'accounting_view',
    'accounting_post_journal', 'accounting_lock_period', 'journal_approval',
    'expense_approval', 'revenue_approval', 'approval_journals', 'approval_expenses',
    'approval_revenues', 'cost_centers', 'mall_manage_shops', 'mall_garden_finance',
    'reports', 'reports_view_sales', 'reports_view_financials',
    'super_admin_full_access', 'users_roles', 'system_manage_users',
    'branch_mgmt', 'developer_options', 'system_backup_update', 'audit_logs',
    'system_audit_logs', 'manage_park_shifts', 'delete_park_shifts', 'park_reports'
  ]::text[]) AS keys(permission_key);

  INSERT INTO public.profiles (
    id, email, username, full_name, phone, role, permissions, created_at, updated_at
  )
  VALUES (
    NEW.id,
    normalized_email,
    normalized_username,
    COALESCE(NULLIF(trim(NEW.raw_user_meta_data ->> 'full_name'), ''), normalized_email),
    NULLIF(trim(COALESCE(NEW.raw_user_meta_data ->> 'phone', '')), ''),
    'admin',
    COALESCE(initial_permissions, jsonb_build_object(
      'super_admin_full_access', true,
      'users_roles', true,
      'system_manage_users', true
    )),
    COALESCE(NEW.created_at, now()),
    now()
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.bootstrap_first_admin_profile() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER on_auth_user_created_initial_admin
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.bootstrap_first_admin_profile();

COMMIT;
