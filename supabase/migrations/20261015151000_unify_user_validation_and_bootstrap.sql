-- Unify user/profile validation and make first-admin bootstrap deterministic.
-- Keeps Auth as the credential store and public.profiles as the managed directory.
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
  v_role text := lower(trim(COALESCE(p_role, 'cashier')));
  v_permissions jsonb := COALESCE(p_permissions, '{}'::jsonb);
  v_invalid_permission_key text;
  v_profile jsonb;
  v_allowed_permission_keys constant text[] := ARRAY[
    'orders',
    'orders_view',
    'orders_create_custom',
    'orders_cancel_modify',
    'orders_manage_carts',
    'orders_generate_qr',
    'pos',
    'pos_access',
    'pos_create_custom_order',
    'pos_apply_discounts',
    'pos_void_items',
    'restaurant_open_shift',
    'restaurant_returns',
    'captain',
    'captain_access',
    'captain_create_order',
    'captain_transfer_tables',
    'captain_modify_items',
    'kitchen',
    'kitchen_view',
    'kitchen_change_status',
    'kitchen_modify_order',
    'delivery',
    'delivery_view',
    'delivery_update_status',
    'inventory',
    'inventory_view',
    'inventory_adjust_transfer',
    'inventory_waste_dispose',
    'purchasing',
    'purchasing_view',
    'purchasing_add_invoice',
    'purchasing_returns',
    'production',
    'production_view',
    'production_execute',
    'hr',
    'hr_view_attendance',
    'hr_manage_payroll_loans',
    'treasury',
    'treasury_view',
    'treasury_open_close',
    'treasury_transfer_reconcile',
    'accounting',
    'accounting_view',
    'accounting_post_journal',
    'accounting_lock_period',
    'journal_approval',
    'expense_approval',
    'revenue_approval',
    'cost_centers',
    'mall_manage_shops',
    'mall_garden_finance',
    'reports',
    'reports_view_sales',
    'reports_view_financials',
    'super_admin_full_access',
    'users_roles',
    'system_manage_users',
    'branch_mgmt',
    'developer_options',
    'system_backup_update',
    'audit_logs',
    'system_audit_logs',
    'manage_park_shifts',
    'delete_park_shifts',
    'park_reports',
    'park_open_shift',
    'park_returns',
    'approval_journals',
    'approval_expenses',
    'approval_revenues'
  ];
BEGIN
  IF auth.uid() IS NULL OR NOT public.current_user_can_manage_profiles() THEN
    RAISE EXCEPTION 'NOT_AUTHORIZED: you do not have permission to manage Users and permissions.';
  END IF;

  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'USER_ID_INVALID: a valid Supabase Auth UUID is required.';
  END IF;

  IF v_username !~ '^[a-z0-9._-]{3,32}$' THEN
    RAISE EXCEPTION 'INVALID_USERNAME: username must be 3-32 lowercase ASCII letters, digits, dots, dashes, or underscores.';
  END IF;

  IF v_full_name = '' THEN
    RAISE EXCEPTION 'FULL_NAME_REQUIRED: enter the user full name.';
  END IF;
  IF length(v_full_name) > 120 THEN
    RAISE EXCEPTION 'FULL_NAME_TOO_LONG: full name cannot exceed 120 characters.';
  END IF;
  IF length(v_phone) > 40 THEN
    RAISE EXCEPTION 'PHONE_TOO_LONG: phone cannot exceed 40 characters.';
  END IF;

  IF v_role NOT IN ('admin', 'super_admin', 'manager', 'cashier', 'captain', 'kitchen') THEN
    RAISE EXCEPTION 'INVALID_ROLE: unsupported user role.';
  END IF;

  IF jsonb_typeof(v_permissions) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'INVALID_PERMISSIONS: permissions must be a JSON object.';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM jsonb_each(v_permissions) AS entry(key, value)
     WHERE jsonb_typeof(entry.value) IS DISTINCT FROM 'boolean'
  ) THEN
    RAISE EXCEPTION 'INVALID_PERMISSIONS: every permission value must be boolean.';
  END IF;

  SELECT entry.key
    INTO v_invalid_permission_key
    FROM jsonb_each(v_permissions) AS entry(key, value)
   WHERE NOT (entry.key = ANY(v_allowed_permission_keys))
   LIMIT 1;
  IF FOUND THEN
    RAISE EXCEPTION 'INVALID_PERMISSION_KEY: unsupported permission key "%".', v_invalid_permission_key;
  END IF;

  SELECT lower(trim(u.email))
    INTO v_email
    FROM auth.users AS u
   WHERE u.id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'AUTH_USER_NOT_FOUND: the matching Supabase Auth account does not exist.';
  END IF;
  IF NULLIF(v_email, '') IS NULL
     OR length(v_email) > 254
     OR v_email !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]{2,}$' THEN
    RAISE EXCEPTION 'EMAIL_INVALID: the Supabase Auth account must have a valid email address.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.profiles p
     WHERE p.id <> p_user_id
       AND lower(trim(COALESCE(p.username, ''))) = v_username
  ) THEN
    RAISE EXCEPTION 'USERNAME_ALREADY_EXISTS: choose a different username.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.profiles p
     WHERE p.id <> p_user_id
       AND lower(trim(COALESCE(p.email, ''))) = v_email
  ) THEN
    RAISE EXCEPTION 'EMAIL_ALREADY_EXISTS: this email already belongs to another profile.';
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
    -- A concurrent/late first-admin request must fail atomically instead of leaving
    -- an Auth identity without a managed profile. Ordinary managed-user signups do
    -- not carry this one-time marker and continue to the Users-page RPC workflow.
    IF COALESCE(NEW.raw_user_meta_data ->> 'bootstrap_first_admin', 'false') = 'true' THEN
      RAISE EXCEPTION 'INITIAL_ADMIN_SETUP_CLOSED: the first administrator has already been created or an Auth identity already exists.';
    END IF;
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
    'orders',
    'orders_view',
    'orders_create_custom',
    'orders_cancel_modify',
    'orders_manage_carts',
    'orders_generate_qr',
    'pos',
    'pos_access',
    'pos_create_custom_order',
    'pos_apply_discounts',
    'pos_void_items',
    'restaurant_open_shift',
    'restaurant_returns',
    'captain',
    'captain_access',
    'captain_create_order',
    'captain_transfer_tables',
    'captain_modify_items',
    'kitchen',
    'kitchen_view',
    'kitchen_change_status',
    'kitchen_modify_order',
    'delivery',
    'delivery_view',
    'delivery_update_status',
    'inventory',
    'inventory_view',
    'inventory_adjust_transfer',
    'inventory_waste_dispose',
    'purchasing',
    'purchasing_view',
    'purchasing_add_invoice',
    'purchasing_returns',
    'production',
    'production_view',
    'production_execute',
    'hr',
    'hr_view_attendance',
    'hr_manage_payroll_loans',
    'treasury',
    'treasury_view',
    'treasury_open_close',
    'treasury_transfer_reconcile',
    'accounting',
    'accounting_view',
    'accounting_post_journal',
    'accounting_lock_period',
    'journal_approval',
    'expense_approval',
    'revenue_approval',
    'cost_centers',
    'mall_manage_shops',
    'mall_garden_finance',
    'reports',
    'reports_view_sales',
    'reports_view_financials',
    'super_admin_full_access',
    'users_roles',
    'system_manage_users',
    'branch_mgmt',
    'developer_options',
    'system_backup_update',
    'audit_logs',
    'system_audit_logs',
    'manage_park_shifts',
    'delete_park_shifts',
    'park_reports',
    'park_open_shift',
    'park_returns',
    'approval_journals',
    'approval_expenses',
    'approval_revenues'
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

COMMIT;
