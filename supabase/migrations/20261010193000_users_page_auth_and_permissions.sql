-- The current Users page is the sole source of managed login accounts and ACL grants.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS username text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS permissions jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Preserve accounts previously created by the old Users page: its signup stored full_name,
-- phone and role in Auth metadata but sometimes failed to create the matching profile row.
INSERT INTO public.profiles (id, username, full_name, phone, role, permissions, created_at, updated_at)
SELECT
  u.id,
  lower(trim(split_part(coalesce(u.email, ''), '@', 1))),
  nullif(u.raw_user_meta_data ->> 'full_name', ''),
  nullif(u.raw_user_meta_data ->> 'phone', ''),
  CASE WHEN u.raw_user_meta_data ->> 'role' IN ('admin','super_admin','manager','cashier','captain','kitchen')
       THEN u.raw_user_meta_data ->> 'role' ELSE 'cashier' END,
  '{}'::jsonb,
  coalesce(u.created_at, now()),
  coalesce(u.updated_at, now())
FROM auth.users u
WHERE lower(split_part(coalesce(u.email, ''), '@', 2))
      IN ('restocash.local', 'almokhtar.local', 'mokhtar.local', 'restocash.com', 'juba.com')
  AND (
    u.raw_user_meta_data ? 'full_name'
    OR u.raw_user_meta_data ? 'phone'
    OR u.raw_user_meta_data ? 'role'
  )
  AND NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = u.id)
ON CONFLICT (id) DO NOTHING;

-- Normalize usernames and make collisions deterministic before enforcing uniqueness.
WITH source_rows AS (
  SELECT p.id,
         lower(trim(coalesce(
           nullif(p.username, ''),
           nullif(u.raw_user_meta_data ->> 'username', ''),
           split_part(coalesce(u.email, ''), '@', 1),
           'user'
         ))) AS base_username,
         p.created_at
  FROM public.profiles p
  LEFT JOIN auth.users u ON u.id = p.id
),
ranked AS (
  SELECT id, base_username,
         row_number() OVER (PARTITION BY base_username ORDER BY created_at NULLS LAST, id) AS rn
  FROM source_rows
)
UPDATE public.profiles p
SET username = CASE WHEN ranked.rn = 1 THEN ranked.base_username
                    ELSE ranked.base_username || '_' || right(replace(ranked.id::text, '-', ''), 6) END
FROM ranked
WHERE ranked.id = p.id
  AND (p.username IS NULL OR trim(p.username) = '' OR p.username <> CASE
       WHEN ranked.rn = 1 THEN ranked.base_username
       ELSE ranked.base_username || '_' || right(replace(ranked.id::text, '-', ''), 6) END);

-- Give existing profiles a conservative starting permission set only when no granular
-- permissions were saved yet. Every later edit comes from the Users page.
UPDATE public.profiles
SET permissions = CASE
  WHEN role IN ('admin', 'super_admin') THEN (SELECT jsonb_object_agg(k, true) FROM unnest(ARRAY['orders', 'orders_view', 'orders_create_custom', 'orders_cancel_modify', 'orders_manage_carts', 'orders_generate_qr', 'pos', 'pos_access', 'pos_create_custom_order', 'pos_apply_discounts', 'pos_void_items', 'captain', 'captain_access', 'captain_create_order', 'captain_transfer_tables', 'captain_modify_items', 'kitchen', 'kitchen_view', 'kitchen_change_status', 'kitchen_modify_order', 'delivery', 'delivery_view', 'delivery_update_status', 'inventory', 'inventory_view', 'inventory_adjust_transfer', 'inventory_waste_dispose', 'purchasing', 'purchasing_view', 'purchasing_add_invoice', 'purchasing_returns', 'production', 'production_view', 'production_execute', 'hr', 'hr_view_attendance', 'hr_manage_payroll_loans', 'treasury', 'treasury_view', 'treasury_open_close', 'treasury_transfer_reconcile', 'accounting', 'accounting_view', 'accounting_post_journal', 'accounting_lock_period', 'journal_approval', 'expense_approval', 'revenue_approval', 'cost_centers', 'mall_manage_shops', 'mall_garden_finance', 'reports', 'reports_view_sales', 'reports_view_financials', 'super_admin_full_access', 'users_roles', 'system_manage_users', 'branch_mgmt', 'developer_options', 'system_backup_update', 'audit_logs', 'system_audit_logs', 'manage_park_shifts', 'delete_park_shifts', 'park_reports']::text[]) AS k)
  WHEN role = 'manager' THEN (SELECT jsonb_object_agg(k, false) FROM unnest(ARRAY['orders', 'orders_view', 'orders_create_custom', 'orders_cancel_modify', 'orders_manage_carts', 'orders_generate_qr', 'pos', 'pos_access', 'pos_create_custom_order', 'pos_apply_discounts', 'pos_void_items', 'captain', 'captain_access', 'captain_create_order', 'captain_transfer_tables', 'captain_modify_items', 'kitchen', 'kitchen_view', 'kitchen_change_status', 'kitchen_modify_order', 'delivery', 'delivery_view', 'delivery_update_status', 'inventory', 'inventory_view', 'inventory_adjust_transfer', 'inventory_waste_dispose', 'purchasing', 'purchasing_view', 'purchasing_add_invoice', 'purchasing_returns', 'production', 'production_view', 'production_execute', 'hr', 'hr_view_attendance', 'hr_manage_payroll_loans', 'treasury', 'treasury_view', 'treasury_open_close', 'treasury_transfer_reconcile', 'accounting', 'accounting_view', 'accounting_post_journal', 'accounting_lock_period', 'journal_approval', 'expense_approval', 'revenue_approval', 'cost_centers', 'mall_manage_shops', 'mall_garden_finance', 'reports', 'reports_view_sales', 'reports_view_financials', 'super_admin_full_access', 'users_roles', 'system_manage_users', 'branch_mgmt', 'developer_options', 'system_backup_update', 'audit_logs', 'system_audit_logs', 'manage_park_shifts', 'delete_park_shifts', 'park_reports']::text[]) AS k) || jsonb_build_object('orders', true, 'orders_view', true, 'orders_create_custom', true, 'orders_manage_carts', true, 'orders_generate_qr', true, 'inventory', true, 'inventory_view', true, 'purchasing', true, 'purchasing_view', true, 'production', true, 'production_view', true, 'accounting', true, 'accounting_view', true, 'journal_approval', true, 'expense_approval', true, 'revenue_approval', true, 'cost_centers', true, 'reports', true, 'reports_view_sales', true, 'reports_view_financials', true, 'hr', true, 'hr_view_attendance', true)
  WHEN role = 'captain' THEN (SELECT jsonb_object_agg(k, false) FROM unnest(ARRAY['orders', 'orders_view', 'orders_create_custom', 'orders_cancel_modify', 'orders_manage_carts', 'orders_generate_qr', 'pos', 'pos_access', 'pos_create_custom_order', 'pos_apply_discounts', 'pos_void_items', 'captain', 'captain_access', 'captain_create_order', 'captain_transfer_tables', 'captain_modify_items', 'kitchen', 'kitchen_view', 'kitchen_change_status', 'kitchen_modify_order', 'delivery', 'delivery_view', 'delivery_update_status', 'inventory', 'inventory_view', 'inventory_adjust_transfer', 'inventory_waste_dispose', 'purchasing', 'purchasing_view', 'purchasing_add_invoice', 'purchasing_returns', 'production', 'production_view', 'production_execute', 'hr', 'hr_view_attendance', 'hr_manage_payroll_loans', 'treasury', 'treasury_view', 'treasury_open_close', 'treasury_transfer_reconcile', 'accounting', 'accounting_view', 'accounting_post_journal', 'accounting_lock_period', 'journal_approval', 'expense_approval', 'revenue_approval', 'cost_centers', 'mall_manage_shops', 'mall_garden_finance', 'reports', 'reports_view_sales', 'reports_view_financials', 'super_admin_full_access', 'users_roles', 'system_manage_users', 'branch_mgmt', 'developer_options', 'system_backup_update', 'audit_logs', 'system_audit_logs', 'manage_park_shifts', 'delete_park_shifts', 'park_reports']::text[]) AS k) || jsonb_build_object('captain', true, 'captain_access', true, 'captain_create_order', true, 'captain_transfer_tables', true, 'captain_modify_items', true, 'orders', true, 'orders_view', true)
  WHEN role = 'kitchen' THEN (SELECT jsonb_object_agg(k, false) FROM unnest(ARRAY['orders', 'orders_view', 'orders_create_custom', 'orders_cancel_modify', 'orders_manage_carts', 'orders_generate_qr', 'pos', 'pos_access', 'pos_create_custom_order', 'pos_apply_discounts', 'pos_void_items', 'captain', 'captain_access', 'captain_create_order', 'captain_transfer_tables', 'captain_modify_items', 'kitchen', 'kitchen_view', 'kitchen_change_status', 'kitchen_modify_order', 'delivery', 'delivery_view', 'delivery_update_status', 'inventory', 'inventory_view', 'inventory_adjust_transfer', 'inventory_waste_dispose', 'purchasing', 'purchasing_view', 'purchasing_add_invoice', 'purchasing_returns', 'production', 'production_view', 'production_execute', 'hr', 'hr_view_attendance', 'hr_manage_payroll_loans', 'treasury', 'treasury_view', 'treasury_open_close', 'treasury_transfer_reconcile', 'accounting', 'accounting_view', 'accounting_post_journal', 'accounting_lock_period', 'journal_approval', 'expense_approval', 'revenue_approval', 'cost_centers', 'mall_manage_shops', 'mall_garden_finance', 'reports', 'reports_view_sales', 'reports_view_financials', 'super_admin_full_access', 'users_roles', 'system_manage_users', 'branch_mgmt', 'developer_options', 'system_backup_update', 'audit_logs', 'system_audit_logs', 'manage_park_shifts', 'delete_park_shifts', 'park_reports']::text[]) AS k) || jsonb_build_object('kitchen', true, 'kitchen_view', true, 'kitchen_change_status', true, 'kitchen_modify_order', true)
  WHEN role = 'cashier' THEN (SELECT jsonb_object_agg(k, false) FROM unnest(ARRAY['orders', 'orders_view', 'orders_create_custom', 'orders_cancel_modify', 'orders_manage_carts', 'orders_generate_qr', 'pos', 'pos_access', 'pos_create_custom_order', 'pos_apply_discounts', 'pos_void_items', 'captain', 'captain_access', 'captain_create_order', 'captain_transfer_tables', 'captain_modify_items', 'kitchen', 'kitchen_view', 'kitchen_change_status', 'kitchen_modify_order', 'delivery', 'delivery_view', 'delivery_update_status', 'inventory', 'inventory_view', 'inventory_adjust_transfer', 'inventory_waste_dispose', 'purchasing', 'purchasing_view', 'purchasing_add_invoice', 'purchasing_returns', 'production', 'production_view', 'production_execute', 'hr', 'hr_view_attendance', 'hr_manage_payroll_loans', 'treasury', 'treasury_view', 'treasury_open_close', 'treasury_transfer_reconcile', 'accounting', 'accounting_view', 'accounting_post_journal', 'accounting_lock_period', 'journal_approval', 'expense_approval', 'revenue_approval', 'cost_centers', 'mall_manage_shops', 'mall_garden_finance', 'reports', 'reports_view_sales', 'reports_view_financials', 'super_admin_full_access', 'users_roles', 'system_manage_users', 'branch_mgmt', 'developer_options', 'system_backup_update', 'audit_logs', 'system_audit_logs', 'manage_park_shifts', 'delete_park_shifts', 'park_reports']::text[]) AS k) || jsonb_build_object('orders', true, 'orders_view', true, 'orders_create_custom', true, 'orders_manage_carts', true, 'orders_generate_qr', true, 'pos', true, 'pos_access', true, 'pos_apply_discounts', true, 'delivery', true, 'delivery_view', true, 'delivery_update_status', true)
  ELSE '{}'::jsonb
END
WHERE permissions IS NULL OR permissions = '{}'::jsonb;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_lower_uidx
  ON public.profiles (lower(username))
  WHERE username IS NOT NULL AND trim(username) <> '';

-- Drop the old trigger and all old permissive profile policies. New Auth identities may
-- only become valid ERP users when the current Users page creates their profile explicitly.
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_created_almokhtar_profile ON auth.users;
DROP POLICY IF EXISTS "TEMP_DEV_ALL_profiles" ON public.profiles;
DROP POLICY IF EXISTS "public manage profiles" ON public.profiles;
DROP POLICY IF EXISTS "profiles select" ON public.profiles;
DROP POLICY IF EXISTS "profiles insert" ON public.profiles;
DROP POLICY IF EXISTS "profiles update" ON public.profiles;
DROP POLICY IF EXISTS "profiles delete" ON public.profiles;
DROP POLICY IF EXISTS "profiles_read_self_or_manager" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_manager" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_manager" ON public.profiles;
DROP POLICY IF EXISTS "profiles_delete_manager" ON public.profiles;

-- Delete Auth identities that have no corresponding entry in the managed Users directory.
-- The old Users-page accounts with metadata have been backfilled above; seeded/current
-- profiles are retained and remain visible in the Users page.
DELETE FROM auth.users u
WHERE NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = u.id);

CREATE OR REPLACE FUNCTION public.current_user_can_manage_profiles()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND (
        p.permissions ->> 'users_roles' = 'true'
        OR p.permissions ->> 'system_manage_users' = 'true'
        OR p.permissions ->> 'super_admin_full_access' = 'true'
      )
  );
$$;
REVOKE ALL ON FUNCTION public.current_user_can_manage_profiles() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_user_can_manage_profiles() TO authenticated;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.profiles FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;

CREATE POLICY "profiles_read_self_or_manager"
  ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.current_user_can_manage_profiles());

CREATE POLICY "profiles_insert_manager"
  ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (public.current_user_can_manage_profiles());

CREATE POLICY "profiles_update_manager"
  ON public.profiles FOR UPDATE TO authenticated
  USING (public.current_user_can_manage_profiles())
  WITH CHECK (public.current_user_can_manage_profiles());

CREATE POLICY "profiles_delete_manager"
  ON public.profiles FOR DELETE TO authenticated
  USING (id <> auth.uid() AND public.current_user_can_manage_profiles());

-- Deleting a managed user from the Users page removes both Auth identity and profile.
CREATE OR REPLACE FUNCTION public.delete_managed_user(target_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count integer;
BEGIN
  IF auth.uid() IS NULL OR NOT public.current_user_can_manage_profiles() THEN
    RAISE EXCEPTION 'Insufficient permission to manage users';
  END IF;
  IF target_user_id = auth.uid() THEN
    RAISE EXCEPTION 'You cannot delete the account you are currently using';
  END IF;

  DELETE FROM public.profiles WHERE id = target_user_id;
  DELETE FROM auth.users WHERE id = target_user_id;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  IF deleted_count = 0 THEN
    RAISE EXCEPTION 'User account not found';
  END IF;
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.delete_managed_user(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_managed_user(uuid) TO authenticated;
