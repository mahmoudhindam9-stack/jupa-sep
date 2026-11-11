-- Secure public QR ordering without exposing the operational ERP tables.
-- Anonymous visitors can read only public menu fields, submit constrained QR orders,
-- and retrieve a single sanitized order using its high-entropy tracking token.

BEGIN;
 
-- Resolve one managed username to its Auth email without exposing profiles-table reads.
-- Supabase Auth still validates the password and applies its normal sign-in rate limits.
CREATE OR REPLACE FUNCTION public.resolve_managed_login_email(p_username TEXT)
RETURNS TEXT
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $resolve_managed_login_email$
  SELECT lower(trim(u.email))
  FROM public.profiles AS p
  JOIN auth.users AS u ON u.id = p.id
  WHERE lower(trim(COALESCE(p.username, ''))) = lower(trim(COALESCE(p_username, '')))
    AND COALESCE(trim(u.email), '') <> ''
    AND COALESCE(trim(p_username), '') ~ '^[a-zA-Z0-9._-]{3,32}$'
  LIMIT 1;
$resolve_managed_login_email$;

REVOKE ALL ON FUNCTION public.resolve_managed_login_email(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_managed_login_email(TEXT) TO anon, authenticated;


-- 1. Enable RLS for operational tables that were still exposed without it.
DO $$
DECLARE
  v_table TEXT;
BEGIN
  FOREACH v_table IN ARRAY ARRAY[
    'inventory',
    'inventory_transactions',
    'tables',
    'purchase_orders',
    'purchase_order_items',
    'warehouse_inventory',
    'warehouses',
    'warehouse_transfers',
    'menu_categories',
    'menu_items',
    'orders',
    'recipes',
    'recipe_ingredients'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', v_table);
  END LOOP;
END;
$$;

-- 2. Remove legacy permissive policies on the tables being re-secured.
DO $$
DECLARE
  v_table TEXT;
  v_policy RECORD;
BEGIN
  FOREACH v_table IN ARRAY ARRAY[
    'inventory',
    'inventory_transactions',
    'tables',
    'purchase_orders',
    'purchase_order_items',
    'warehouse_inventory',
    'warehouses',
    'warehouse_transfers',
    'menu_categories',
    'menu_items',
    'orders',
    'recipes',
    'recipe_ingredients',
    'shift_audit_logs'
  ] LOOP
    FOR v_policy IN
      SELECT policyname
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = v_table
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', v_policy.policyname, v_table);
    END LOOP;
  END LOOP;
END;
$$;

-- 3. Remove anonymous and PUBLIC table privileges from operational data.
REVOKE ALL ON TABLE
  public.inventory,
  public.inventory_transactions,
  public.tables,
  public.purchase_orders,
  public.purchase_order_items,
  public.warehouse_inventory,
  public.warehouses,
  public.warehouse_transfers
FROM PUBLIC, anon;

GRANT ALL ON TABLE
  public.inventory,
  public.inventory_transactions,
  public.tables,
  public.purchase_orders,
  public.purchase_order_items,
  public.warehouse_inventory,
  public.warehouses,
  public.warehouse_transfers
TO authenticated;

-- Permission-aware RLS: an authenticated session alone is not enough.
CREATE OR REPLACE FUNCTION public.current_user_has_any_permission(p_keys TEXT[])
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $current_user_has_any_permission$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles AS p
    WHERE p.id = auth.uid()
      AND (
        p.role IN ('admin', 'super_admin', 'manager')
        OR COALESCE(p.permissions ->> 'super_admin_full_access', 'false') = 'true'
        OR EXISTS (
          SELECT 1
          FROM unnest(COALESCE(p_keys, ARRAY[]::TEXT[])) AS allowed(permission_key)
          WHERE COALESCE(p.permissions ->> allowed.permission_key, 'false') = 'true'
        )
      )
  );
$current_user_has_any_permission$;

REVOKE ALL ON FUNCTION public.current_user_has_any_permission(TEXT[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_has_any_permission(TEXT[]) TO authenticated;

DO $$
DECLARE
  v_table TEXT;
  v_read_keys TEXT[];
  v_write_keys TEXT[];
BEGIN
  FOREACH v_table IN ARRAY ARRAY[
    'inventory', 'inventory_transactions', 'warehouse_inventory', 'warehouses', 'warehouse_transfers'
  ] LOOP
    v_read_keys := ARRAY['inventory', 'inventory_view'];
    v_write_keys := ARRAY['inventory', 'inventory_adjust_transfer', 'inventory_waste_dispose', 'branch_mgmt'];
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (public.current_user_has_any_permission(%L::text[]))',
      v_table || '_authorized_read', v_table, v_read_keys::text
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (public.current_user_has_any_permission(%L::text[])) WITH CHECK (public.current_user_has_any_permission(%L::text[]))',
      v_table || '_authorized_write', v_table, v_write_keys::text, v_write_keys::text
    );
  END LOOP;

  v_read_keys := ARRAY['purchasing', 'purchasing_view'];
  v_write_keys := ARRAY['purchasing', 'purchasing_add_invoice', 'purchasing_returns'];
  FOREACH v_table IN ARRAY ARRAY['purchase_orders', 'purchase_order_items'] LOOP
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (public.current_user_has_any_permission(%L::text[]))',
      v_table || '_authorized_read', v_table, v_read_keys::text
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (public.current_user_has_any_permission(%L::text[])) WITH CHECK (public.current_user_has_any_permission(%L::text[]))',
      v_table || '_authorized_write', v_table, v_write_keys::text, v_write_keys::text
    );
  END LOOP;

  v_read_keys := ARRAY['page_restaurant_tables', 'captain', 'captain_access', 'pos', 'orders', 'orders_view'];
  v_write_keys := ARRAY['page_restaurant_tables', 'captain', 'captain_access', 'captain_transfer_tables', 'pos'];
  v_table := 'tables';
  EXECUTE format(
    'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (public.current_user_has_any_permission(%L::text[]))',
    v_table || '_authorized_read', v_table, v_read_keys::text
  );
  EXECUTE format(
    'CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (public.current_user_has_any_permission(%L::text[])) WITH CHECK (public.current_user_has_any_permission(%L::text[]))',
    v_table || '_authorized_write', v_table, v_write_keys::text, v_write_keys::text
  );
END;
$$;

-- 4. Public menu access is read-only and limited to fields required by the QR menu.
REVOKE ALL ON TABLE public.menu_categories, public.menu_items FROM PUBLIC, anon;
GRANT SELECT (id, name_ar, sort_order, created_at)
  ON TABLE public.menu_categories TO anon;
GRANT SELECT (id, name_ar, price, category_id, image_url, is_available, created_at)
  ON TABLE public.menu_items TO anon;
GRANT ALL ON TABLE public.menu_categories, public.menu_items TO authenticated;

CREATE POLICY menu_categories_public_read
  ON public.menu_categories
  FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY menu_categories_authenticated_manage
  ON public.menu_categories
  FOR ALL TO authenticated
  USING (public.is_manager_or_admin())
  WITH CHECK (public.is_manager_or_admin());

CREATE POLICY menu_items_public_read
  ON public.menu_items
  FOR SELECT TO anon
  USING (true);

CREATE POLICY menu_items_staff_read
  ON public.menu_items
  FOR SELECT TO authenticated
  USING (public.current_user_has_any_permission(ARRAY['page_restaurant_menu','pos','captain','kitchen','orders','orders_view','inventory','inventory_view']));

CREATE POLICY menu_items_authenticated_manage
  ON public.menu_items
  FOR ALL TO authenticated
  USING (public.is_manager_or_admin())
  WITH CHECK (public.is_manager_or_admin());

-- Recipes and ingredient quantities are staff-only, even though menu products are public.
REVOKE ALL ON TABLE public.recipes, public.recipe_ingredients FROM PUBLIC, anon;
GRANT ALL ON TABLE public.recipes, public.recipe_ingredients TO authenticated;

CREATE POLICY recipes_authenticated_read
  ON public.recipes
  FOR SELECT TO authenticated
  USING (public.current_user_has_any_permission(ARRAY['inventory','inventory_view','page_restaurant_menu','production','production_view','accounting','accounting_view','reports_view_financials']));

CREATE POLICY recipes_manager_write
  ON public.recipes
  FOR ALL TO authenticated
  USING (public.is_manager_or_admin())
  WITH CHECK (public.is_manager_or_admin());

CREATE POLICY recipe_ingredients_authenticated_read
  ON public.recipe_ingredients
  FOR SELECT TO authenticated
  USING (public.current_user_has_any_permission(ARRAY['inventory','inventory_view','page_restaurant_menu','production','production_view','accounting','accounting_view','reports_view_financials']));

CREATE POLICY recipe_ingredients_manager_write
  ON public.recipe_ingredients
  FOR ALL TO authenticated
  USING (public.is_manager_or_admin())
  WITH CHECK (public.is_manager_or_admin());

-- 5. Secure orders. Customers can INSERT a QR order or a table-assistance request,
-- but cannot SELECT, UPDATE, or DELETE operational orders through the anonymous API.
REVOKE ALL ON TABLE public.orders FROM PUBLIC, anon;
GRANT ALL ON TABLE public.orders TO authenticated;
GRANT INSERT ON TABLE public.orders TO anon;
GRANT USAGE, SELECT ON SEQUENCE public.orders_order_number_seq TO anon, authenticated;

CREATE POLICY orders_authenticated_select
  ON public.orders
  FOR SELECT TO authenticated
  USING (public.current_user_has_any_permission(ARRAY['orders','orders_view','pos','captain','kitchen','delivery','reports','accounting']));

CREATE POLICY orders_authenticated_insert
  ON public.orders
  FOR INSERT TO authenticated
  WITH CHECK (public.current_user_has_any_permission(ARRAY['orders','orders_create_custom','pos','pos_access','captain','captain_access','captain_create_order','delivery','delivery_update_status']));

CREATE POLICY orders_authenticated_update
  ON public.orders
  FOR UPDATE TO authenticated
  USING (public.current_user_has_any_permission(ARRAY['orders','orders_cancel_modify','pos','pos_access','captain','captain_modify_items','kitchen','kitchen_modify_order','kitchen_change_status','delivery','delivery_update_status']))
  WITH CHECK (public.current_user_has_any_permission(ARRAY['orders','orders_cancel_modify','pos','pos_access','captain','captain_modify_items','kitchen','kitchen_modify_order','kitchen_change_status','delivery','delivery_update_status']));

CREATE POLICY orders_authenticated_delete
  ON public.orders
  FOR DELETE TO authenticated
  USING (public.current_user_has_any_permission(ARRAY['orders_cancel_modify']));

CREATE POLICY orders_anon_qr_insert
  ON public.orders
  FOR INSERT TO anon
  WITH CHECK (
    auth.role() = 'anon'
    AND status = 'pending'
    AND order_type IN ('dine_in', 'takeaway')
    AND payment_method = 'cash'
    AND created_at >= now() - interval '15 minutes'
    AND created_at <= now() + interval '2 minutes'
    AND (
      (
        customer_tracking_token ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        AND total >= 0
        AND subtotal >= 0
        AND tax >= 0
      )
      OR
      (
        customer_tracking_token IS NULL
        AND total = 0
        AND subtotal = 0
        AND tax = 0
        AND items @> '[{"is_assistance_call": true}]'::jsonb
      )
    )
  );

-- Return only a sanitized order summary for the exact UUID token.
CREATE OR REPLACE FUNCTION public.get_customer_order_status(p_tracking_token TEXT)
RETURNS JSONB
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public, auth, extensions, pg_temp
AS $customer_order_status$
  SELECT jsonb_build_object(
    'id', o.id,
    'order_number', o.order_number,
    'status', o.status,
    'total', o.total,
    'pricing_currency', o.pricing_currency,
    'payment_currency', o.payment_currency,
    'payment_amount', o.payment_amount,
    'created_at', o.created_at,
    'items', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'name_ar', COALESCE(line->>'name_ar', line #>> '{item,name_ar}', 'صنف'),
          'name_en', COALESCE(line->>'name_en', line #>> '{item,name_en}'),
          'quantity', COALESCE(line->'quantity', '1'::jsonb),
          'price', COALESCE(line->'price', line #> '{item,price}', '0'::jsonb)
        )
      )
      FROM jsonb_array_elements(o.items) AS line
    ), '[]'::jsonb)
  )
  FROM public.orders AS o
  WHERE p_tracking_token ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    AND o.customer_tracking_token = p_tracking_token
  LIMIT 1;
$customer_order_status$;

REVOKE ALL ON FUNCTION public.get_customer_order_status(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_customer_order_status(TEXT) TO anon, authenticated;

-- 6. Shift audit logs must not be readable or writable by anonymous users.
REVOKE ALL ON TABLE public.shift_audit_logs FROM PUBLIC, anon;
GRANT SELECT, INSERT ON TABLE public.shift_audit_logs TO authenticated;

-- Remove credentials left in historical directory snapshots before tightening access.
UPDATE public.shift_audit_logs AS l
SET metadata = jsonb_set(
  l.metadata,
  '{users}',
  COALESCE((
    SELECT jsonb_agg(u - 'password' - 'password_hash' - 'hashed_password' - 'access_token' - 'refresh_token')
    FROM jsonb_array_elements(COALESCE(l.metadata->'users', '[]'::jsonb)) AS u
  ), '[]'::jsonb),
  true
)
WHERE l.shift_id = 'GLOBAL_USERS_DIRECTORY_SYNC_V1'
  AND jsonb_typeof(l.metadata->'users') = 'array'
  AND EXISTS (
    SELECT 1
    FROM jsonb_array_elements(l.metadata->'users') AS u
    WHERE u ?| ARRAY['password','password_hash','hashed_password','access_token','refresh_token']
  );

CREATE POLICY shift_audit_logs_authenticated_insert
  ON public.shift_audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND (
      shift_id IS DISTINCT FROM 'GLOBAL_USERS_DIRECTORY_SYNC_V1'
      OR public.current_user_can_manage_profiles()
    )
  );

CREATE POLICY shift_audit_logs_role_based_read
  ON public.shift_audit_logs
  FOR SELECT TO authenticated
  USING (
    shift_id IS DISTINCT FROM 'GLOBAL_USERS_DIRECTORY_SYNC_V1'
    AND EXISTS (
      SELECT 1
      FROM public.profiles AS p
      WHERE p.id = auth.uid()
        AND (
          p.role IN ('admin', 'super_admin', 'manager', 'accountant')
          OR COALESCE(p.permissions ->> 'audit_logs', 'false') = 'true'
          OR COALESCE(p.permissions ->> 'system_audit_logs', 'false') = 'true'
        )
    )
  );

CREATE POLICY shift_audit_logs_users_directory_read
  ON public.shift_audit_logs
  FOR SELECT TO authenticated
  USING (
    shift_id = 'GLOBAL_USERS_DIRECTORY_SYNC_V1'
    AND public.current_user_can_manage_profiles()
  );

-- 7. Clean up anonymous/PUBLIC grants on accounting tables that already have RLS.
REVOKE ALL ON TABLE public.journal_entries, public.journal_lines FROM PUBLIC, anon;
GRANT ALL ON TABLE public.journal_entries, public.journal_lines TO authenticated;

-- Security-definer helpers are not callable anonymously. The first-admin availability
-- check intentionally remains public because it is required by the first-user flow.
REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

REVOKE ALL ON FUNCTION public.is_manager_or_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_manager_or_admin() TO authenticated;

REVOKE ALL ON FUNCTION public.admin_count() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_count() TO authenticated;

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.validate_shift_audit_log_workflow() FROM PUBLIC, anon, authenticated;

-- The legacy menu RPC was callable without a login and had no internal authorization check.
CREATE OR REPLACE FUNCTION public.create_or_update_menu_item_with_recipe(
  p_id UUID DEFAULT NULL,
  p_name_ar TEXT DEFAULT '',
  p_price NUMERIC DEFAULT 0,
  p_category_id UUID DEFAULT NULL,
  p_image_url TEXT DEFAULT NULL,
  p_is_available BOOLEAN DEFAULT TRUE,
  p_inventory_tracking TEXT DEFAULT 'not_tracked',
  p_ingredients JSONB DEFAULT '[]'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions, pg_temp
AS $secured_menu_write$
DECLARE
  v_menu_item RECORD;
BEGIN
  IF auth.uid() IS NULL OR NOT (public.is_admin() OR public.is_manager_or_admin()) THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501',
      MESSAGE = 'NOT_AUTHORIZED: an authenticated manager or administrator is required.';
  END IF;

  IF p_price < 0 OR NULLIF(trim(COALESCE(p_name_ar, '')), '') IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = '22023',
      MESSAGE = 'INVALID_MENU_ITEM: name and a non-negative price are required.';
  END IF;

  IF p_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.menu_items WHERE id = p_id
  ) THEN
    UPDATE public.menu_items
    SET name_ar = p_name_ar,
        price = p_price,
        category_id = p_category_id,
        image_url = p_image_url,
        is_available = p_is_available,
        inventory_tracking = p_inventory_tracking,
        ingredients = COALESCE(p_ingredients, '[]'::jsonb)
    WHERE id = p_id
    RETURNING * INTO v_menu_item;
  ELSE
    INSERT INTO public.menu_items (
      name_ar, price, category_id, image_url, is_available, inventory_tracking, ingredients
    ) VALUES (
      p_name_ar, p_price, p_category_id, p_image_url, p_is_available,
      p_inventory_tracking, COALESCE(p_ingredients, '[]'::jsonb)
    )
    RETURNING * INTO v_menu_item;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'menu_item', row_to_json(v_menu_item)
  );
END;
$secured_menu_write$;

REVOKE ALL ON FUNCTION public.create_or_update_menu_item_with_recipe(
  UUID, TEXT, NUMERIC, UUID, TEXT, BOOLEAN, TEXT, JSONB
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_or_update_menu_item_with_recipe(
  UUID, TEXT, NUMERIC, UUID, TEXT, BOOLEAN, TEXT, JSONB
) TO authenticated;

-- 8. Harden public SECURITY DEFINER functions that had no fixed search_path.
DO $$
DECLARE
  v_function RECORD;
BEGIN
  FOR v_function IN
    SELECT p.oid::regprocedure AS signature
    FROM pg_proc AS p
    JOIN pg_namespace AS n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef
      AND NOT EXISTS (
        SELECT 1
        FROM unnest(COALESCE(p.proconfig, ARRAY[]::text[])) AS setting
        WHERE setting LIKE 'search_path=%'
      )
  LOOP
    EXECUTE format(
      'ALTER FUNCTION %s SET search_path = public, auth, extensions, pg_temp',
      v_function.signature
    );
  END LOOP;
END;
$$;

COMMIT;
