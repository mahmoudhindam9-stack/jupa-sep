-- One-time user-directory reset requested for the clean Supabase bootstrap.
-- This is intentionally destructive: it deletes every existing Auth account and profile.
-- Operational tables are not truncated. After this migration, the first Auth signup only
-- receives administrator access when the profile directory is still empty.
BEGIN;

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email text;

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
  has_profiles boolean;
  initial_permissions jsonb;
  normalized_email text;
  normalized_username text;
BEGIN
  -- Serialize signups so two simultaneous first registrations cannot both become admins.
  PERFORM pg_advisory_xact_lock(hashtext('jupa-sep-initial-admin-bootstrap'), 0);

  SELECT EXISTS (SELECT 1 FROM public.profiles) INTO has_profiles;
  IF has_profiles THEN
    -- Later Auth identities are not automatically managed ERP users. They must be
    -- explicitly added through the authenticated Users page.
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
