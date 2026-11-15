-- ============================================================================
-- COMPLETE RESTAURANT WORKFLOW FIX & ACTIVATION
-- 1. Menu customizations (quick_options, additions with optional inventory link,
--    prep_instructions, allergens, requires_oven, badge)
-- 2. Full normalized raw materials + per-serving recipes for every menu item
--    (WITHOUT fabricating fake inventory balances)
-- 3. Multi-warehouse transfer from Main Warehouse to Oven/Kitchen Sub-Warehouse
--    only where real source balance > 0
-- 4. Unified atomic single-deduction engine (recipe + linked additions, idempotent)
-- 5. Server-side QR Order Lifecycle Timestamps & Mandatory Post-Delivery Feedback
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. Extend menu_items for product-specific quick options, additions & recipes
-- ----------------------------------------------------------------------------
ALTER TABLE public.menu_items
  ADD COLUMN IF NOT EXISTS badge text,
  ADD COLUMN IF NOT EXISTS requires_oven boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS quick_options jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS additions jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS prep_instructions text,
  ADD COLUMN IF NOT EXISTS allergens jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Allow anon QR menu visitors to read safe customization fields (NOT staff recipes/costs)
GRANT SELECT (id, name_ar, price, category_id, image_url, is_available, created_at, badge, requires_oven, quick_options, additions)
  ON TABLE public.menu_items TO anon;

-- Extend create_or_update_menu_item_with_recipe so manager edits persist everything + recipes table
DROP FUNCTION IF EXISTS public.create_or_update_menu_item_with_recipe(
  UUID, TEXT, NUMERIC, UUID, TEXT, BOOLEAN, TEXT, JSONB
);

CREATE OR REPLACE FUNCTION public.create_or_update_menu_item_with_recipe(
  p_id UUID DEFAULT NULL,
  p_name_ar TEXT DEFAULT '',
  p_price NUMERIC DEFAULT 0,
  p_category_id UUID DEFAULT NULL,
  p_image_url TEXT DEFAULT NULL,
  p_is_available BOOLEAN DEFAULT TRUE,
  p_inventory_tracking TEXT DEFAULT 'not_tracked',
  p_ingredients JSONB DEFAULT '[]'::jsonb,
  p_badge TEXT DEFAULT NULL,
  p_requires_oven BOOLEAN DEFAULT FALSE,
  p_quick_options JSONB DEFAULT '[]'::jsonb,
  p_additions JSONB DEFAULT '[]'::jsonb,
  p_prep_instructions TEXT DEFAULT NULL,
  p_allergens JSONB DEFAULT '[]'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions, pg_temp
AS $fn$
DECLARE
  v_menu_item RECORD;
  v_recipe_id UUID;
  v_ing JSONB;
  v_inv_id UUID;
  v_wt NUMERIC;
  v_unit TEXT;
  v_opt BOOLEAN;
  v_waste NUMERIC;
  v_notes TEXT;
  v_effective_tracking TEXT;
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

  v_effective_tracking := COALESCE(
    NULLIF(trim(p_inventory_tracking), ''),
    CASE WHEN jsonb_typeof(p_ingredients) = 'array' AND jsonb_array_length(p_ingredients) > 0 THEN 'recipe_required' ELSE 'not_tracked' END
  );

  IF p_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.menu_items WHERE id = p_id) THEN
    UPDATE public.menu_items
    SET name_ar = p_name_ar,
        price = p_price,
        category_id = p_category_id,
        image_url = p_image_url,
        is_available = p_is_available,
        inventory_tracking = v_effective_tracking,
        ingredients = COALESCE(p_ingredients, '[]'::jsonb),
        badge = p_badge,
        requires_oven = COALESCE(p_requires_oven, false),
        quick_options = COALESCE(p_quick_options, '[]'::jsonb),
        additions = COALESCE(p_additions, '[]'::jsonb),
        prep_instructions = p_prep_instructions,
        allergens = COALESCE(p_allergens, '[]'::jsonb)
    WHERE id = p_id
    RETURNING * INTO v_menu_item;
  ELSE
    INSERT INTO public.menu_items (
      name_ar, price, category_id, image_url, is_available, inventory_tracking, ingredients,
      badge, requires_oven, quick_options, additions, prep_instructions, allergens
    ) VALUES (
      p_name_ar, p_price, p_category_id, p_image_url, p_is_available, v_effective_tracking,
      COALESCE(p_ingredients, '[]'::jsonb),
      p_badge, COALESCE(p_requires_oven, false),
      COALESCE(p_quick_options, '[]'::jsonb),
      COALESCE(p_additions, '[]'::jsonb),
      p_prep_instructions,
      COALESCE(p_allergens, '[]'::jsonb)
    )
    RETURNING * INTO v_menu_item;
  END IF;

  -- Keep normalized recipes / recipe_ingredients tables synchronized
  IF jsonb_typeof(p_ingredients) = 'array' AND jsonb_array_length(p_ingredients) > 0 THEN
    INSERT INTO public.recipes (menu_item_id, notes)
    VALUES (v_menu_item.id, p_prep_instructions)
    ON CONFLICT (menu_item_id) DO UPDATE SET
      notes = COALESCE(EXCLUDED.notes, public.recipes.notes),
      updated_at = now()
    RETURNING id INTO v_recipe_id;

    DELETE FROM public.recipe_ingredients WHERE recipe_id = v_recipe_id;

    FOR v_ing IN SELECT * FROM jsonb_array_elements(p_ingredients) LOOP
      v_inv_id := NULLIF(v_ing->>'inventory_id', '')::uuid;
      v_wt := COALESCE((v_ing->>'weight')::numeric, (v_ing->>'quantity')::numeric, 0);
      v_unit := COALESCE(NULLIF(v_ing->>'unit', ''), 'pcs');
      v_opt := COALESCE((v_ing->>'optional')::boolean, false);
      v_waste := (v_ing->>'waste_percent')::numeric;
      v_notes := v_ing->>'notes';

      IF v_inv_id IS NOT NULL AND v_wt > 0 AND EXISTS (SELECT 1 FROM public.inventory WHERE id = v_inv_id) THEN
        INSERT INTO public.recipe_ingredients (
          recipe_id, inventory_id, quantity, weight, unit, notes, optional, waste_percent
        ) VALUES (
          v_recipe_id, v_inv_id, v_wt, v_wt, v_unit, v_notes, v_opt, v_waste
        )
        ON CONFLICT (recipe_id, inventory_id) DO UPDATE SET
          quantity = EXCLUDED.quantity,
          weight = EXCLUDED.weight,
          unit = EXCLUDED.unit,
          notes = EXCLUDED.notes,
          optional = EXCLUDED.optional,
          waste_percent = EXCLUDED.waste_percent,
          updated_at = now();
      END IF;
    END LOOP;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'menu_item', row_to_json(v_menu_item)
  );
END;
$fn$;

REVOKE ALL ON FUNCTION public.create_or_update_menu_item_with_recipe(
  UUID, TEXT, NUMERIC, UUID, TEXT, BOOLEAN, TEXT, JSONB, TEXT, BOOLEAN, JSONB, JSONB, TEXT, JSONB
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_or_update_menu_item_with_recipe(
  UUID, TEXT, NUMERIC, UUID, TEXT, BOOLEAN, TEXT, JSONB, TEXT, BOOLEAN, JSONB, JSONB, TEXT, JSONB
) TO authenticated;

-- ----------------------------------------------------------------------------
-- 2. Extend orders lifecycle statuses, server timestamps & inventory column
-- ----------------------------------------------------------------------------
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS submitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS captain_confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS kitchen_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS ready_at timestamptz,
  ADD COLUMN IF NOT EXISTS delivered_at timestamptz,
  ADD COLUMN IF NOT EXISTS is_qr_order boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS customer_name text,
  ADD COLUMN IF NOT EXISTS inventory_deducted boolean NOT NULL DEFAULT false;

ALTER TABLE public.inventory_transactions
  ADD COLUMN IF NOT EXISTS warehouse_id uuid REFERENCES public.warehouses(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL;

ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE public.orders
  ADD CONSTRAINT orders_status_check
  CHECK (
    status IN (
      'pending',
      'pending_captain',
      'STATUS_PENDING_CAPTAIN',
      'sent_to_cashier',
      'preparing',
      'ready',
      'delivered',
      'served',
      'completed',
      'cancelled'
    )
  );

-- Backfill safe historical fields without inventing fake timestamps
UPDATE public.orders
SET
  submitted_at = COALESCE(submitted_at, created_at),
  is_qr_order = (
    customer_tracking_token IS NOT NULL
    OR COALESCE(notes, '') ILIKE '%SELF_ORDER%'
    OR COALESCE(notes, '') ILIKE '%باركود العميل%'
    OR COALESCE(notes, '') ILIKE '%الطلب الذاتي%'
  ),
  delivered_at = CASE
    WHEN status IN ('served', 'delivered', 'completed') THEN COALESCE(delivered_at, updated_at, created_at)
    ELSE delivered_at
  END
WHERE submitted_at IS NULL OR (status IN ('served', 'delivered', 'completed') AND delivered_at IS NULL);

-- Automatically maintain stage timestamps whenever an order advances
CREATE OR REPLACE FUNCTION public.maintain_order_lifecycle_timestamps()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_old_notes text := COALESCE(CASE WHEN TG_OP = 'UPDATE' THEN OLD.notes ELSE '' END, '');
  v_new_notes text := COALESCE(NEW.notes, '');
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.submitted_at := COALESCE(NEW.submitted_at, NEW.created_at, now());
    NEW.is_qr_order := COALESCE(NEW.is_qr_order, false)
      OR (NEW.customer_tracking_token IS NOT NULL)
      OR (v_new_notes ILIKE '%SELF_ORDER%')
      OR (v_new_notes ILIKE '%باركود العميل%')
      OR (v_new_notes ILIKE '%الطلب الذاتي%');
  ELSE
    NEW.submitted_at := COALESCE(NEW.submitted_at, OLD.submitted_at, NEW.created_at, now());
    NEW.is_qr_order := COALESCE(NEW.is_qr_order, OLD.is_qr_order, false)
      OR (NEW.customer_tracking_token IS NOT NULL);
  END IF;

  -- Extract customer name tag if missing
  IF NEW.customer_name IS NULL AND v_new_notes ~ '\[العميل:\s*([^\]]+)\]' THEN
    NEW.customer_name := NULLIF(trim((regexp_match(v_new_notes, '\[العميل:\s*([^\]]+)\]'))[1]), '');
  END IF;

  -- Captain confirmation timestamp (when status becomes sent_to_cashier or SELF_ORDER_ACTIVE added)
  IF (
    NEW.status = 'sent_to_cashier'
    OR (v_new_notes LIKE '%[SELF_ORDER_ACTIVE]%' AND v_old_notes LIKE '%[SELF_ORDER_PENDING_CAPTAIN]%')
    OR (NEW.status = 'preparing' AND NEW.captain_confirmed_at IS NULL AND COALESCE(NEW.is_qr_order, false))
  ) THEN
    NEW.captain_confirmed_at := COALESCE(NEW.captain_confirmed_at, now());
  END IF;

  -- Kitchen started timestamp
  IF (
    NEW.status = 'preparing'
    OR (v_new_notes LIKE '%[SENT_TO_KITCHEN]%' AND v_old_notes NOT LIKE '%[SENT_TO_KITCHEN]%')
  ) THEN
    NEW.kitchen_started_at := COALESCE(NEW.kitchen_started_at, now());
  END IF;

  -- Ready timestamp
  IF NEW.status = 'ready' THEN
    NEW.captain_confirmed_at := COALESCE(NEW.captain_confirmed_at, NEW.submitted_at);
    NEW.kitchen_started_at := COALESCE(NEW.kitchen_started_at, NEW.captain_confirmed_at);
    NEW.ready_at := COALESCE(NEW.ready_at, now());
  END IF;

  -- Delivered timestamp (stops customer overall timer ONLY on delivery)
  IF NEW.status IN ('served', 'delivered', 'completed') THEN
    NEW.captain_confirmed_at := COALESCE(NEW.captain_confirmed_at, NEW.submitted_at);
    NEW.kitchen_started_at := COALESCE(NEW.kitchen_started_at, NEW.captain_confirmed_at);
    NEW.ready_at := COALESCE(NEW.ready_at, now());
    NEW.delivered_at := COALESCE(NEW.delivered_at, now());
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_orders_lifecycle_timestamps ON public.orders;
CREATE TRIGGER trg_orders_lifecycle_timestamps
  BEFORE INSERT OR UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.maintain_order_lifecycle_timestamps();

-- Ensure RLS anon insert still accepts safe customer_name & is_qr_order columns
DROP POLICY IF EXISTS "orders_anon_qr_insert" ON public.orders;
CREATE POLICY "orders_anon_qr_insert"
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

-- ----------------------------------------------------------------------------
-- 3. Post-delivery feedback table + secure customer RPCs
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.order_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL UNIQUE REFERENCES public.orders(id) ON DELETE CASCADE,
  order_number integer,
  customer_tracking_token text,
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment text,
  customer_name text,
  customer_phone text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_order_feedback_created_at ON public.order_feedback(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_order_feedback_rating ON public.order_feedback(rating);

ALTER TABLE public.order_feedback ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.order_feedback FROM PUBLIC, anon;
GRANT SELECT, INSERT ON TABLE public.order_feedback TO authenticated;
GRANT ALL ON TABLE public.order_feedback TO service_role;

DROP POLICY IF EXISTS "order_feedback_authorized_read" ON public.order_feedback;
CREATE POLICY "order_feedback_authorized_read"
  ON public.order_feedback
  FOR SELECT TO authenticated
  USING (public.current_user_has_any_permission(ARRAY['orders','orders_view','reports','reports_view_sales','reports_view_financials','captain','kitchen']));

DROP POLICY IF EXISTS "order_feedback_authenticated_insert" ON public.order_feedback;
CREATE POLICY "order_feedback_authenticated_insert"
  ON public.order_feedback
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- Customer-safe RPC to submit mandatory post-delivery rating (prevents duplicate submissions)
CREATE OR REPLACE FUNCTION public.submit_customer_order_feedback(
  p_tracking_token TEXT,
  p_rating INTEGER,
  p_comment TEXT DEFAULT NULL,
  p_customer_name TEXT DEFAULT NULL,
  p_customer_phone TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions, pg_temp
AS $fn$
DECLARE
  v_order RECORD;
  v_feedback RECORD;
BEGIN
  IF NOT (COALESCE(p_tracking_token, '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$') THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_TOKEN', 'error_ar', 'رمز تتبع الطلب غير صالح');
  END IF;

  IF p_rating IS NULL OR p_rating < 1 OR p_rating > 5 THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_RATING', 'error_ar', 'يرجى اختيار تقييم من 1 إلى 5 نجوم');
  END IF;

  SELECT * INTO v_order
  FROM public.orders
  WHERE customer_tracking_token = p_tracking_token
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'ORDER_NOT_FOUND', 'error_ar', 'الطلب غير موجود');
  END IF;

  IF v_order.status NOT IN ('served', 'delivered', 'completed') THEN
    RETURN jsonb_build_object('success', false, 'error', 'ORDER_NOT_DELIVERED', 'error_ar', 'يمكن إرسال التقييم بعد تسليم الطلب فقط');
  END IF;

  IF EXISTS (SELECT 1 FROM public.order_feedback WHERE order_id = v_order.id) THEN
    SELECT * INTO v_feedback FROM public.order_feedback WHERE order_id = v_order.id LIMIT 1;
    RETURN jsonb_build_object(
      'success', false,
      'error', 'ALREADY_RATED',
      'error_ar', 'تم استلام تقييمك لهذا الطلب مسبقاً',
      'feedback', row_to_json(v_feedback)
    );
  END IF;

  INSERT INTO public.order_feedback (
    order_id,
    order_number,
    customer_tracking_token,
    rating,
    comment,
    customer_name,
    customer_phone
  ) VALUES (
    v_order.id,
    v_order.order_number,
    p_tracking_token,
    p_rating,
    NULLIF(trim(COALESCE(p_comment, '')), ''),
    COALESCE(NULLIF(trim(COALESCE(p_customer_name, '')), ''), v_order.customer_name),
    NULLIF(trim(COALESCE(p_customer_phone, '')), '')
  )
  RETURNING * INTO v_feedback;

  RETURN jsonb_build_object(
    'success', true,
    'feedback', row_to_json(v_feedback)
  );
END;
$fn$;

REVOKE ALL ON FUNCTION public.submit_customer_order_feedback(TEXT, INTEGER, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_customer_order_feedback(TEXT, INTEGER, TEXT, TEXT, TEXT) TO anon, authenticated;

-- Upgrade get_customer_order_status to return stage timestamps, options/additions, table label, and feedback
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
    'notes', CASE
      WHEN COALESCE(o.notes, '') LIKE '%[SELF_ORDER_PENDING_CAPTAIN]%' THEN '[SELF_ORDER_PENDING_CAPTAIN]'
      WHEN COALESCE(o.notes, '') LIKE '%[SELF_ORDER_ACTIVE]%' THEN '[SELF_ORDER_ACTIVE]'
      ELSE ''
    END,
    'total', o.total,
    'pricing_currency', o.pricing_currency,
    'payment_currency', o.payment_currency,
    'payment_amount', o.payment_amount,
    'customer_name', o.customer_name,
    'table_label', COALESCE(t.name, CASE WHEN t.number IS NOT NULL THEN 'طاولة ' || t.number ELSE NULL END),
    'created_at', o.created_at,
    'submitted_at', COALESCE(o.submitted_at, o.created_at),
    'captain_confirmed_at', o.captain_confirmed_at,
    'kitchen_started_at', o.kitchen_started_at,
    'ready_at', o.ready_at,
    'delivered_at', o.delivered_at,
    'updated_at', o.updated_at,
    'has_feedback', (fb.id IS NOT NULL),
    'feedback', CASE WHEN fb.id IS NOT NULL THEN row_to_json(fb)::jsonb ELSE NULL END,
    'items', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'name_ar', COALESCE(line->>'name_ar', line #>> '{item,name_ar}', 'صنف'),
          'name_en', COALESCE(line->>'name_en', line #>> '{item,name_en}'),
          'quantity', COALESCE(line->'quantity', '1'::jsonb),
          'price', COALESCE(line->'price', line #> '{item,price}', '0'::jsonb),
          'notes', line->>'notes',
          'selectedOptions', COALESCE(line->'selectedOptions', '[]'::jsonb),
          'selectedAdditions', COALESCE(line->'selectedAdditions', '[]'::jsonb)
        )
      )
      FROM jsonb_array_elements(o.items) AS line
    ), '[]'::jsonb)
  )
  FROM public.orders AS o
  LEFT JOIN public.tables AS t ON t.id = o.table_id
  LEFT JOIN public.order_feedback AS fb ON fb.order_id = o.id
  WHERE p_tracking_token ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    AND o.customer_tracking_token = p_tracking_token
  LIMIT 1;
$customer_order_status$;

REVOKE ALL ON FUNCTION public.get_customer_order_status(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_customer_order_status(TEXT) TO anon, authenticated;

-- ----------------------------------------------------------------------------
-- 4. Unify Single-Deduction Inventory Engine (Recipe + Inventory-Linked Additions)
--    Targets the Kitchen / Oven Sub-Warehouse ("مخزن الفرن والمطبخ") atomically
-- ----------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_order_inventory_changes ON public.orders;
DROP TRIGGER IF EXISTS trg_apply_order_stock ON public.orders;

CREATE OR REPLACE FUNCTION public.resolve_operational_kitchen_warehouse_id()
RETURNS UUID
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(
    (SELECT id FROM public.warehouses WHERE name ILIKE '%الفرن%' OR name ILIKE '%مطبخ%' ORDER BY is_default ASC, created_at ASC LIMIT 1),
    (SELECT id FROM public.warehouses WHERE is_default = true LIMIT 1),
    (SELECT id FROM public.warehouses ORDER BY created_at ASC LIMIT 1)
  );
$$;

CREATE OR REPLACE FUNCTION public.start_order_preparing(
  p_order_id uuid,
  p_allow_negative boolean DEFAULT true,
  p_warehouse_id uuid DEFAULT NULL
)
RETURNS jsonb
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $fn$
DECLARE
  v_order record;
  v_order_item jsonb;
  v_addition jsonb;
  v_recipe_ingredient record;
  v_inv_item record;
  v_wh_stock record;
  v_required_qty numeric;
  v_converted_qty numeric;
  v_ingredients_checked boolean := true;
  v_shortage_msg text := '';
  v_tx_note text;
  v_item_id uuid;
  v_add_inv_id uuid;
  v_menu_item_name text;
  v_tracking_mode text;
  v_recipe_id uuid;
  v_target_wh_id uuid;
  v_has_deductions_to_make boolean := false;
BEGIN
  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Order not found', 'error_ar', 'الطلب غير موجود');
  END IF;

  -- Determine target Kitchen sub-warehouse
  v_target_wh_id := COALESCE(p_warehouse_id, v_order.warehouse_id, public.resolve_operational_kitchen_warehouse_id());

  -- Strict Single-Deduction Guard
  IF COALESCE(v_order.inventory_deducted, FALSE) THEN
    IF v_order.status = 'pending' THEN
      UPDATE public.orders
      SET status = 'preparing',
          warehouse_id = COALESCE(warehouse_id, v_target_wh_id),
          updated_at = now()
      WHERE id = p_order_id;
    END IF;
    RETURN jsonb_build_object(
      'success', true,
      'already_deducted', true,
      'message', 'Order already had inventory deducted',
      'message_ar', 'تم خصم مكونات هذا الطلب مسبقاً دون تكرار'
    );
  END IF;

  -- Skip non-food table assistance calls
  IF COALESCE(v_order.notes, '') LIKE '%[TABLE_ASSISTANCE_CALL]%'
     OR COALESCE(v_order.notes, '') LIKE '%[BILL_REQUEST]%' THEN
    UPDATE public.orders SET status = 'preparing', updated_at = now() WHERE id = p_order_id;
    RETURN jsonb_build_object('success', true, 'message', 'Assistance request acknowledged');
  END IF;

  -- Check shortages first when strict stock validation is enabled
  IF jsonb_typeof(v_order.items) = 'array' THEN
    FOR v_order_item IN SELECT * FROM jsonb_array_elements(v_order.items) LOOP
      v_item_id := COALESCE(NULLIF(v_order_item->>'menu_item_id', '')::uuid, NULLIF(v_order_item->>'id', '')::uuid);
      IF v_item_id IS NULL THEN CONTINUE; END IF;

      SELECT name_ar, COALESCE(inventory_tracking, 'not_tracked')
      INTO v_menu_item_name, v_tracking_mode
      FROM public.menu_items WHERE id = v_item_id;

      IF NOT FOUND THEN CONTINUE; END IF;

      IF v_tracking_mode = 'recipe_required' THEN
        SELECT id INTO v_recipe_id FROM public.recipes WHERE menu_item_id = v_item_id LIMIT 1;
        IF v_recipe_id IS NULL THEN
          RETURN jsonb_build_object(
            'success', false,
            'error', 'Recipe required for item: ' || v_menu_item_name,
            'error_ar', 'الصنف "' || v_menu_item_name || '" يتطلب وصفة مرتبطة قبل التحضير'
          );
        END IF;

        FOR v_recipe_ingredient IN
          SELECT * FROM public.recipe_ingredients WHERE recipe_id = v_recipe_id
        LOOP
          SELECT * INTO v_inv_item FROM public.inventory WHERE id = v_recipe_ingredient.inventory_id FOR UPDATE;
          IF FOUND THEN
            v_required_qty := COALESCE(v_recipe_ingredient.weight, v_recipe_ingredient.quantity, 0) * COALESCE((v_order_item->>'quantity')::numeric, 1);
            v_converted_qty := public.convert_to_inventory_unit(v_required_qty, v_recipe_ingredient.unit, v_inv_item.unit);

            SELECT * INTO v_wh_stock FROM public.warehouse_inventory
            WHERE warehouse_id = v_target_wh_id AND inventory_id = v_recipe_ingredient.inventory_id
            FOR UPDATE;

            IF NOT p_allow_negative AND NOT COALESCE(v_recipe_ingredient.optional, false) AND COALESCE(v_wh_stock.quantity, 0) < v_converted_qty THEN
              v_ingredients_checked := false;
              v_shortage_msg := v_shortage_msg || v_inv_item.name_ar || ' (المطلوب ' || round(v_converted_qty, 3) || '، المتاح ' || COALESCE(v_wh_stock.quantity, 0) || ' ' || COALESCE(v_inv_item.unit, '') || '); ';
            END IF;
          END IF;
        END LOOP;
      END IF;
    END LOOP;
  END IF;

  IF NOT v_ingredients_checked THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Insufficient stock',
      'error_ar', 'عجز في رصيد مخزن الفرن والمطبخ: ' || v_shortage_msg
    );
  END IF;

  -- Perform single atomic deduction for recipe ingredients + linked selectedAdditions
  IF jsonb_typeof(v_order.items) = 'array' THEN
    FOR v_order_item IN SELECT * FROM jsonb_array_elements(v_order.items) LOOP
      v_item_id := COALESCE(NULLIF(v_order_item->>'menu_item_id', '')::uuid, NULLIF(v_order_item->>'id', '')::uuid);
      v_menu_item_name := COALESCE(v_order_item->>'name_ar', 'صنف');

      IF v_item_id IS NOT NULL THEN
        FOR v_recipe_ingredient IN
          SELECT ri.* FROM public.recipe_ingredients ri
          JOIN public.recipes r ON r.id = ri.recipe_id
          WHERE r.menu_item_id = v_item_id
        LOOP
          SELECT * INTO v_inv_item FROM public.inventory WHERE id = v_recipe_ingredient.inventory_id FOR UPDATE;
          IF FOUND THEN
            v_required_qty := COALESCE(v_recipe_ingredient.weight, v_recipe_ingredient.quantity, 0) * COALESCE((v_order_item->>'quantity')::numeric, 1);
            v_converted_qty := public.convert_to_inventory_unit(v_required_qty, v_recipe_ingredient.unit, v_inv_item.unit);

            IF v_converted_qty > 0 THEN
              v_has_deductions_to_make := true;
              INSERT INTO public.warehouse_inventory (warehouse_id, inventory_id, quantity, min_level)
              VALUES (v_target_wh_id, v_recipe_ingredient.inventory_id, 0, COALESCE(v_inv_item.min_level, 0))
              ON CONFLICT (warehouse_id, inventory_id) DO NOTHING;

              UPDATE public.warehouse_inventory
              SET quantity = quantity - v_converted_qty, updated_at = now()
              WHERE warehouse_id = v_target_wh_id AND inventory_id = v_recipe_ingredient.inventory_id;

              UPDATE public.inventory
              SET quantity = (
                SELECT COALESCE(SUM(quantity), 0) FROM public.warehouse_inventory WHERE inventory_id = v_recipe_ingredient.inventory_id
              ), updated_at = now()
              WHERE id = v_recipe_ingredient.inventory_id;

              v_tx_note := 'خصم وصفة تلقائي - طلب #' || COALESCE(v_order.order_number::text, v_order.id::text) || ' (' || v_menu_item_name || ')';
              INSERT INTO public.inventory_transactions (inventory_id, warehouse_id, order_id, type, quantity, note, created_at)
              VALUES (v_recipe_ingredient.inventory_id, v_target_wh_id, p_order_id, 'out', v_converted_qty, v_tx_note, now());
            END IF;
          END IF;
        END LOOP;
      END IF;

      -- Also deduct inventory-linked selectedAdditions (only when inventory_id is linked)
      IF jsonb_typeof(v_order_item->'selectedAdditions') = 'array' THEN
        FOR v_addition IN SELECT * FROM jsonb_array_elements(v_order_item->'selectedAdditions') LOOP
          IF jsonb_typeof(v_addition) = 'object' AND NULLIF(v_addition->>'inventory_id', '') IS NOT NULL THEN
            BEGIN
              v_add_inv_id := (v_addition->>'inventory_id')::uuid;
            EXCEPTION WHEN OTHERS THEN
              v_add_inv_id := NULL;
            END;

            IF v_add_inv_id IS NOT NULL THEN
              SELECT * INTO v_inv_item FROM public.inventory WHERE id = v_add_inv_id FOR UPDATE;
              IF FOUND THEN
                v_required_qty := COALESCE((v_addition->>'deduct_qty')::numeric, 0) * COALESCE((v_order_item->>'quantity')::numeric, 1);
                v_converted_qty := public.convert_to_inventory_unit(v_required_qty, v_addition->>'deduct_unit', v_inv_item.unit);

                IF v_converted_qty > 0 THEN
                  v_has_deductions_to_make := true;
                  INSERT INTO public.warehouse_inventory (warehouse_id, inventory_id, quantity, min_level)
                  VALUES (v_target_wh_id, v_add_inv_id, 0, COALESCE(v_inv_item.min_level, 0))
                  ON CONFLICT (warehouse_id, inventory_id) DO NOTHING;

                  UPDATE public.warehouse_inventory
                  SET quantity = quantity - v_converted_qty, updated_at = now()
                  WHERE warehouse_id = v_target_wh_id AND inventory_id = v_add_inv_id;

                  UPDATE public.inventory
                  SET quantity = (
                    SELECT COALESCE(SUM(quantity), 0) FROM public.warehouse_inventory WHERE inventory_id = v_add_inv_id
                  ), updated_at = now()
                  WHERE id = v_add_inv_id;

                  v_tx_note := 'خصم إضافة تلقائي - طلب #' || COALESCE(v_order.order_number::text, v_order.id::text) || ' (+' || COALESCE(v_addition->>'name_ar', 'إضافة') || ')';
                  INSERT INTO public.inventory_transactions (inventory_id, warehouse_id, order_id, type, quantity, note, created_at)
                  VALUES (v_add_inv_id, v_target_wh_id, p_order_id, 'out', v_converted_qty, v_tx_note, now());
                END IF;
              END IF;
            END IF;
          END IF;
        END LOOP;
      END IF;
    END LOOP;
  END IF;

  UPDATE public.orders
  SET warehouse_id = v_target_wh_id,
      inventory_deducted = v_has_deductions_to_make OR COALESCE(inventory_deducted, false),
      inventory_processed_at = CASE WHEN v_has_deductions_to_make THEN now() ELSE inventory_processed_at END,
      inventory_reversed = FALSE,
      inventory_reversed_at = NULL,
      status = CASE WHEN status IN ('pending', 'pending_captain', 'STATUS_PENDING_CAPTAIN', 'sent_to_cashier') THEN 'preparing' ELSE status END,
      updated_at = now()
  WHERE id = p_order_id;

  RETURN jsonb_build_object(
    'success', true,
    'warehouse_id', v_target_wh_id,
    'deducted', v_has_deductions_to_make,
    'message', 'Inventory deducted atomically from operational kitchen warehouse',
    'message_ar', 'تم خصم مكونات الطلب بنجاح من مخزن الفرن والمطبخ'
  );
END;
$fn$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.start_order_preparing(
  p_order_id uuid,
  p_allow_negative boolean DEFAULT true
)
RETURNS jsonb
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
BEGIN
  RETURN public.start_order_preparing(p_order_id, p_allow_negative, NULL::uuid);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.process_order_inventory(
  p_order_id uuid,
  p_allow_negative boolean DEFAULT true,
  p_warehouse_id uuid DEFAULT NULL
)
RETURNS jsonb
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
BEGIN
  RETURN public.start_order_preparing(p_order_id, p_allow_negative, p_warehouse_id);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.cancel_order(p_order_id uuid)
RETURNS jsonb
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $fn$
DECLARE
  v_order record;
  v_tx record;
  v_has_reversed boolean := false;
  v_target_wh_id uuid;
BEGIN
  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Order not found', 'error_ar', 'الطلب غير موجود');
  END IF;

  IF v_order.status = 'cancelled' AND COALESCE(v_order.inventory_reversed, false) THEN
    RETURN jsonb_build_object('success', true, 'message', 'Order already cancelled and restored');
  END IF;

  IF COALESCE(v_order.inventory_deducted, false) AND NOT COALESCE(v_order.inventory_reversed, false) THEN
    FOR v_tx IN
      SELECT * FROM public.inventory_transactions
      WHERE order_id = p_order_id AND type = 'out'
    LOOP
      v_has_reversed := true;
      v_target_wh_id := COALESCE(v_tx.warehouse_id, v_order.warehouse_id, public.resolve_operational_kitchen_warehouse_id());

      UPDATE public.warehouse_inventory
      SET quantity = quantity + v_tx.quantity, updated_at = now()
      WHERE warehouse_id = v_target_wh_id AND inventory_id = v_tx.inventory_id;

      UPDATE public.inventory
      SET quantity = (
        SELECT COALESCE(SUM(quantity), 0) FROM public.warehouse_inventory WHERE inventory_id = v_tx.inventory_id
      ), updated_at = now()
      WHERE id = v_tx.inventory_id;

      INSERT INTO public.inventory_transactions (
        inventory_id, warehouse_id, order_id, type, quantity, note, created_at
      ) VALUES (
        v_tx.inventory_id, v_target_wh_id, p_order_id, 'in', v_tx.quantity,
        'ORDER_RETURN - استرجاع إلغاء طلب #' || COALESCE(v_order.order_number::text, v_order.id::text),
        now()
      );
    END LOOP;
  END IF;

  UPDATE public.orders
  SET inventory_deducted = FALSE,
      inventory_reversed = CASE WHEN v_has_reversed THEN TRUE ELSE COALESCE(inventory_reversed, FALSE) END,
      inventory_reversed_at = CASE WHEN v_has_reversed THEN now() ELSE inventory_reversed_at END,
      status = 'cancelled',
      updated_at = now()
  WHERE id = p_order_id;

  RETURN jsonb_build_object('success', true, 'restored', v_has_reversed);
END;
$fn$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.reverse_order_inventory(p_order_id uuid)
RETURNS jsonb
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
BEGIN
  RETURN public.cancel_order(p_order_id);
END;
$$ LANGUAGE plpgsql;

REVOKE EXECUTE ON FUNCTION public.start_order_preparing(uuid, boolean, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.start_order_preparing(uuid, boolean) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.process_order_inventory(uuid, boolean, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.cancel_order(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.reverse_order_inventory(uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.start_order_preparing(uuid, boolean, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.start_order_preparing(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.process_order_inventory(uuid, boolean, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_order(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reverse_order_inventory(uuid) TO authenticated;

-- ----------------------------------------------------------------------------
-- 5. Seed Normalized Raw Materials, Complete Recipes for All Menu Items,
--    and Transfer Available Real Main-Warehouse Stock to Kitchen Sub-Warehouse
--    (STRICT HONESTY: ZERO fabricated balances on empty inventory items)
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  v_main_wh_id uuid;
  v_kitchen_wh_id uuid;
  v_mat record;
  v_inv_id uuid;
  v_main_qty numeric;
  v_kitchen_qty numeric;
  v_transfer_qty numeric;
  v_menu_rec record;
  v_recipe_id uuid;
  v_ing jsonb;
  v_ingredients_json jsonb;
  v_quick_opts jsonb;
  v_additions_json jsonb;
  v_allergens jsonb;
  v_prep text;
  v_req_oven boolean;
BEGIN
  -- Ensure Main Warehouse exists
  SELECT id INTO v_main_wh_id FROM public.warehouses WHERE is_default = true ORDER BY created_at ASC LIMIT 1;
  IF v_main_wh_id IS NULL THEN
    INSERT INTO public.warehouses (name, description, location, is_active, is_default)
    VALUES ('المخزن الرئيسي', 'المخزن الرئيسي الافتراضي للمطعم', 'الفرع الرئيسي', true, true)
    RETURNING id INTO v_main_wh_id;
  END IF;

  -- Ensure Kitchen/Oven Sub-Warehouse exists
  SELECT id INTO v_kitchen_wh_id
  FROM public.warehouses
  WHERE name ILIKE '%الفرن%' OR name ILIKE '%مطبخ%'
  ORDER BY is_default ASC, created_at ASC
  LIMIT 1;

  IF v_kitchen_wh_id IS NULL THEN
    INSERT INTO public.warehouses (name, description, location, is_active, is_default)
    VALUES ('مخزن الفرن والمطبخ', 'مخزن التشغيل اليومي للفرن والمطبخ', 'المطبخ الداخلي', true, false)
    RETURNING id INTO v_kitchen_wh_id;
  END IF;

  -- Ensure every normalized raw material record exists (NEVER fabricate stock quantities: default to 0 if new)
  FOR v_mat IN
    SELECT * FROM (VALUES
      ('دقيق بيتزا', 'kg', 5::numeric, 28::numeric, 4::numeric),
      ('جبنة موزاريلا', 'kg', 2::numeric, 145::numeric, 2::numeric),
      ('جبنة شيدر', 'kg', 1::numeric, 165::numeric, 1::numeric),
      ('صلصة طماطم بيتزا', 'kg', 2::numeric, 40::numeric, 2::numeric),
      ('طماطم طازجة', 'kg', 3::numeric, 18::numeric, 2::numeric),
      ('فلفل رومي', 'kg', 1::numeric, 25::numeric, 1::numeric),
      ('بصل طازج', 'kg', 2::numeric, 15::numeric, 1.5::numeric),
      ('زيتون أسود شرائح', 'kg', 1::numeric, 90::numeric, 1::numeric),
      ('مشروم طازج', 'kg', 1::numeric, 110::numeric, 1::numeric),
      ('بيبروني بقري', 'kg', 1::numeric, 260::numeric, 1::numeric),
      ('لحم مفروم', 'kg', 4::numeric, 240::numeric, 3::numeric),
      ('دجاج', 'kg', 5::numeric, 150::numeric, 4::numeric),
      ('خبز برجر', 'pcs', 20::numeric, 4::numeric, 25::numeric),
      ('عيش صاج / شاورما', 'pcs', 20::numeric, 3::numeric, 25::numeric),
      ('بطاطس', 'kg', 5::numeric, 22::numeric, 4::numeric),
      ('خس كابوتشا', 'kg', 1::numeric, 25::numeric, 1::numeric),
      ('خيار طازج', 'kg', 1::numeric, 20::numeric, 1::numeric),
      ('جبنة فيتا', 'kg', 1::numeric, 130::numeric, 1::numeric),
      ('حمص مسلوق', 'kg', 2::numeric, 55::numeric, 1.5::numeric),
      ('باذنجان مشوي', 'kg', 2::numeric, 24::numeric, 1.5::numeric),
      ('طحينة سمسم', 'kg', 1::numeric, 120::numeric, 1::numeric),
      ('زيت زيتون', 'l', 1::numeric, 220::numeric, 1::numeric),
      ('زيت قلى نباتي', 'l', 3::numeric, 65::numeric, 2::numeric),
      ('صوص سيزر ومايونيز', 'kg', 1::numeric, 95::numeric, 1::numeric),
      ('كوكاكولا', 'can', 12::numeric, 10::numeric, 12::numeric),
      ('برتقال للعصير', 'kg', 3::numeric, 20::numeric, 3::numeric),
      ('شاي أسود فاخر', 'kg', 0.5::numeric, 240::numeric, 0.5::numeric),
      ('نعناع طازج', 'kg', 0.5::numeric, 40::numeric, 0.5::numeric),
      ('بن قهوة تركي', 'kg', 0.5::numeric, 380::numeric, 0.5::numeric),
      ('سكر أبيض', 'kg', 2::numeric, 32::numeric, 1::numeric),
      ('عجينة كنافة', 'kg', 2::numeric, 50::numeric, 1.5::numeric),
      ('قشطة بلدي', 'kg', 1::numeric, 140::numeric, 1::numeric),
      ('سمن طبيعي', 'kg', 1::numeric, 190::numeric, 1::numeric),
      ('حليب طازج', 'l', 3::numeric, 35::numeric, 2::numeric),
      ('سميد بسبوسة', 'kg', 2::numeric, 38::numeric, 1.5::numeric),
      ('رقائق جلاش / ميل فاي', 'kg', 1::numeric, 70::numeric, 1::numeric),
      ('شربات حلويات (قطر)', 'l', 2::numeric, 30::numeric, 1.5::numeric),
      ('مياه معدنية صغيرة', 'bottle', 12::numeric, 5::numeric, 12::numeric)
    ) AS t(name_ar, unit, min_level, cost, target_kitchen_batch)
  LOOP
    SELECT id INTO v_inv_id FROM public.inventory WHERE trim(name_ar) = trim(v_mat.name_ar) LIMIT 1;
    IF v_inv_id IS NULL THEN
      INSERT INTO public.inventory (name_ar, unit, quantity, min_level, cost)
      VALUES (v_mat.name_ar, v_mat.unit, 0, v_mat.min_level, v_mat.cost)
      RETURNING id INTO v_inv_id;
    END IF;

    -- Ensure warehouse_inventory rows exist in both Main and Kitchen warehouses (preserving real balances)
    INSERT INTO public.warehouse_inventory (warehouse_id, inventory_id, quantity, min_level)
    SELECT v_main_wh_id, v_inv_id, COALESCE(i.quantity, 0), COALESCE(i.min_level, v_mat.min_level)
    FROM public.inventory i WHERE i.id = v_inv_id
    ON CONFLICT (warehouse_id, inventory_id) DO NOTHING;

    INSERT INTO public.warehouse_inventory (warehouse_id, inventory_id, quantity, min_level)
    VALUES (v_kitchen_wh_id, v_inv_id, 0, v_mat.min_level)
    ON CONFLICT (warehouse_id, inventory_id) DO NOTHING;

    -- Transfer ONLY if Main Warehouse genuinely holds real stock (> 0) and Kitchen has < target batch
    SELECT COALESCE(quantity, 0) INTO v_main_qty FROM public.warehouse_inventory
    WHERE warehouse_id = v_main_wh_id AND inventory_id = v_inv_id;

    SELECT COALESCE(quantity, 0) INTO v_kitchen_qty FROM public.warehouse_inventory
    WHERE warehouse_id = v_kitchen_wh_id AND inventory_id = v_inv_id;

    IF v_main_qty > 0 AND v_kitchen_qty < v_mat.target_kitchen_batch THEN
      v_transfer_qty := LEAST(v_mat.target_kitchen_batch - v_kitchen_qty, v_main_qty * 0.5);
      v_transfer_qty := round(v_transfer_qty, 3);
      IF v_transfer_qty > 0 THEN
        PERFORM public.transfer_inventory(
          v_main_wh_id,
          v_kitchen_wh_id,
          v_inv_id,
          v_transfer_qty,
          'تجهيز تلقائي لرصيد مخزن الفرن والمطبخ وفق احتياج الوصفات'
        );
      END IF;
    END IF;
  END LOOP;

  -- Link every menu item cleanly to actual normalized inventory_id UUIDs
  FOR v_menu_rec IN SELECT id, name_ar FROM public.menu_items LOOP
    v_ingredients_json := '[]'::jsonb;
    v_quick_opts := '[]'::jsonb;
    v_additions_json := '[]'::jsonb;
    v_allergens := '[]'::jsonb;
    v_prep := NULL;
    v_req_oven := false;

    IF v_menu_rec.name_ar = 'بيتزا سوبر سوبريم' THEN
      v_req_oven := true;
      v_prep := 'تفرد كرة العجين 220 جم، تُدهن بصلصة الطماطم، ثم تضاف شرائح البيبروني واللحم والفلفل والزيتون والمشروم وتغطى بالموزاريلا. تُخبز في الفرن على حرارة 280°م لمدة 7-9 دقائق.';
      v_allergens := '["غلوتين (قمح)", "ألبان"]'::jsonb;
      v_quick_opts := '[{"id":"no_onion","label_ar":"بدون بصل","label_en":"No Onion","group":"exclude"},{"id":"no_pepper","label_ar":"بدون فلفل","label_en":"No Pepper","group":"exclude"},{"id":"no_olives","label_ar":"بدون زيتون","label_en":"No Olives","group":"exclude"},{"id":"thin_crust","label_ar":"عجينة رفيعة","label_en":"Thin Crust","group":"prep"}]'::jsonb;
      v_additions_json := jsonb_build_array(
        jsonb_build_object('id','extra_mozzarella','name_ar','جبنة موزاريلا إضافية','price',1.5,'inventory_id',(SELECT id FROM public.inventory WHERE name_ar='جبنة موزاريلا' LIMIT 1),'deduct_qty',50,'deduct_unit','g'),
        jsonb_build_object('id','extra_onion','name_ar','بصل إضافي','price',0.4,'inventory_id',(SELECT id FROM public.inventory WHERE name_ar='بصل طازج' LIMIT 1),'deduct_qty',25,'deduct_unit','g')
      );
      v_ingredients_json := jsonb_build_array(
        jsonb_build_object('inventory_id',(SELECT id FROM public.inventory WHERE name_ar='دقيق بيتزا' LIMIT 1),'weight',220,'unit','g'),
        jsonb_build_object('inventory_id',(SELECT id FROM public.inventory WHERE name_ar='صلصة طماطم بيتزا' LIMIT 1),'weight',80,'unit','g'),
        jsonb_build_object('inventory_id',(SELECT id FROM public.inventory WHERE name_ar='جبنة موزاريلا' LIMIT 1),'weight',140,'unit','g'),
        jsonb_build_object('inventory_id',(SELECT id FROM public.inventory WHERE name_ar='لحم مفروم' LIMIT 1),'weight',60,'unit','g'),
        jsonb_build_object('inventory_id',(SELECT id FROM public.inventory WHERE name_ar='بيبروني بقري' LIMIT 1),'weight',40,'unit','g'),
        jsonb_build_object('inventory_id',(SELECT id FROM public.inventory WHERE name_ar='فلفل رومي' LIMIT 1),'weight',35,'unit','g','optional',true),
        jsonb_build_object('inventory_id',(SELECT id FROM public.inventory WHERE name_ar='بصل طازج' LIMIT 1),'weight',25,'unit','g','optional',true),
        jsonb_build_object('inventory_id',(SELECT id FROM public.inventory WHERE name_ar='زيتون أسود شرائح' LIMIT 1),'weight',25,'unit','g','optional',true),
        jsonb_build_object('inventory_id',(SELECT id FROM public.inventory WHERE name_ar='مشروم طازج' LIMIT 1),'weight',30,'unit','g','optional',true)
      );
    ELSIF v_menu_rec.name_ar = 'بيتزا مارجريتا' THEN
      v_req_oven := true;
      v_prep := 'تفرد كرة العجين 220 جم، تُغطى بصلصة الطماطم وجبنة الموزاريلا وزيت الزيتون وتُخبز في الفرن لمدة 6-8 دقائق.';
      v_allergens := '["غلوتين (قمح)", "ألبان"]'::jsonb;
      v_quick_opts := '[{"id":"thin_crust","label_ar":"عجينة رفيعة","label_en":"Thin Crust","group":"prep"},{"id":"well_done","label_ar":"تحمير إضافي","label_en":"Well Done","group":"prep"}]'::jsonb;
      v_additions_json := jsonb_build_array(
        jsonb_build_object('id','extra_mozzarella','name_ar','جبنة موزاريلا إضافية','price',1.5,'inventory_id',(SELECT id FROM public.inventory WHERE name_ar='جبنة موزاريلا' LIMIT 1),'deduct_qty',50,'deduct_unit','g')
      );
      v_ingredients_json := jsonb_build_array(
        jsonb_build_object('inventory_id',(SELECT id FROM public.inventory WHERE name_ar='دقيق بيتزا' LIMIT 1),'weight',220,'unit','g'),
        jsonb_build_object('inventory_id',(SELECT id FROM public.inventory WHERE name_ar='صلصة طماطم بيتزا' LIMIT 1),'weight',90,'unit','g'),
        jsonb_build_object('inventory_id',(SELECT id FROM public.inventory WHERE name_ar='جبنة موزاريلا' LIMIT 1),'weight',150,'unit','g'),
        jsonb_build_object('inventory_id',(SELECT id FROM public.inventory WHERE name_ar='زيت زيتون' LIMIT 1),'weight',10,'unit','ml')
      );
    ELSIF v_menu_rec.name_ar = 'بيتزا بيبروني' THEN
      v_req_oven := true;
      v_prep := 'تفرد كرة العجين 220 جم، تضاف صلصة الطماطم والموزاريلا وشرائح البيبروني وتُخبز بالفرن لمدة 7-8 دقائق.';
      v_allergens := '["غلوتين (قمح)", "ألبان"]'::jsonb;
      v_quick_opts := '[{"id":"thin_crust","label_ar":"عجينة رفيعة","label_en":"Thin Crust","group":"prep"},{"id":"no_onion","label_ar":"بدون بصل","label_en":"No Onion","group":"exclude"}]'::jsonb;
      v_additions_json := jsonb_build_array(
        jsonb_build_object('id','extra_mozzarella','name_ar','جبنة موزاريلا إضافية','price',1.5,'inventory_id',(SELECT id FROM public.inventory WHERE name_ar='جبنة موزاريلا' LIMIT 1),'deduct_qty',50,'deduct_unit','g'),
        jsonb_build_object('id','extra_pepperoni','name_ar','بيبروني إضافي','price',2.0,'inventory_id',(SELECT id FROM public.inventory WHERE name_ar='بيبروني بقري' LIMIT 1),'deduct_qty',35,'deduct_unit','g')
      );
      v_ingredients_json := jsonb_build_array(
        jsonb_build_object('inventory_id',(SELECT id FROM public.inventory WHERE name_ar='دقيق بيتزا' LIMIT 1),'weight',220,'unit','g'),
        jsonb_build_object('inventory_id',(SELECT id FROM public.inventory WHERE name_ar='صلصة طماطم بيتزا' LIMIT 1),'weight',80,'unit','g'),
        jsonb_build_object('inventory_id',(SELECT id FROM public.inventory WHERE name_ar='جبنة موزاريلا' LIMIT 1),'weight',140,'unit','g'),
        jsonb_build_object('inventory_id',(SELECT id FROM public.inventory WHERE name_ar='بيبروني بقري' LIMIT 1),'weight',70,'unit','g')
      );
    ELSIF v_menu_rec.name_ar = 'برجر لحم فاخر' THEN
      v_prep := 'تُشوى قطعة اللحم 180 جم على الجريل 4 دقائق لكل وجه مع شريحة الشيدر، ويُحمص الخبز ويُضاف الخس والطماطم والبصل.';
      v_allergens := '["غلوتين (قمح)", "ألبان", "سمسم"]'::jsonb;
      v_quick_opts := '[{"id":"no_onion","label_ar":"بدون بصل","label_en":"No Onion","group":"exclude"},{"id":"no_tomato","label_ar":"بدون طماطم","label_en":"No Tomato","group":"exclude"},{"id":"well_done","label_ar":"سوى كامل","label_en":"Well Done","group":"prep"}]'::jsonb;
      v_additions_json := jsonb_build_array(
        jsonb_build_object('id','extra_cheddar','name_ar','شريحة جبنة شيدر إضافية','price',1.0,'inventory_id',(SELECT id FROM public.inventory WHERE name_ar='جبنة شيدر' LIMIT 1),'deduct_qty',30,'deduct_unit','g'),
        jsonb_build_object('id','side_fries','name_ar','بطاطس مقلية جانبية','price',1.5,'inventory_id',(SELECT id FROM public.inventory WHERE name_ar='بطاطس' LIMIT 1),'deduct_qty',120,'deduct_unit','g')
      );
      v_ingredients_json := jsonb_build_array(
        jsonb_build_object('inventory_id',(SELECT id FROM public.inventory WHERE name_ar='لحم مفروم' LIMIT 1),'weight',180,'unit','g'),
        jsonb_build_object('inventory_id',(SELECT id FROM public.inventory WHERE name_ar='خبز برجر' LIMIT 1),'weight',1,'unit','pcs'),
        jsonb_build_object('inventory_id',(SELECT id FROM public.inventory WHERE name_ar='جبنة شيدر' LIMIT 1),'weight',30,'unit','g'),
        jsonb_build_object('inventory_id',(SELECT id FROM public.inventory WHERE name_ar='خس كابوتشا' LIMIT 1),'weight',25,'unit','g','optional',true),
        jsonb_build_object('inventory_id',(SELECT id FROM public.inventory WHERE name_ar='طماطم طازجة' LIMIT 1),'weight',30,'unit','g','optional',true),
        jsonb_build_object('inventory_id',(SELECT id FROM public.inventory WHERE name_ar='بصل طازج' LIMIT 1),'weight',20,'unit','g','optional',true)
      );
    ELSIF v_menu_rec.name_ar = 'برجر دجاج مقرمش' THEN
      v_prep := 'تُقلى شريحة الدجاج المتبلة حتى النضج الذهبي وتُقدم في خبز البرجر المحمص مع الشيدر والخس والصوص.';
      v_allergens := '["غلوتين (قمح)", "ألبان", "بيض"]'::jsonb;
      v_quick_opts := '[{"id":"spicy","label_ar":"سبايسي (حار)","label_en":"Spicy","group":"spice"},{"id":"no_tomato","label_ar":"بدون طماطم","label_en":"No Tomato","group":"exclude"}]'::jsonb;
      v_additions_json := jsonb_build_array(
        jsonb_build_object('id','extra_cheddar','name_ar','شريحة جبنة شيدر إضافية','price',1.0,'inventory_id',(SELECT id FROM public.inventory WHERE name_ar='جبنة شيدر' LIMIT 1),'deduct_qty',30,'deduct_unit','g'),
        jsonb_build_object('id','side_fries','name_ar','بطاطس مقلية جانبية','price',1.5,'inventory_id',(SELECT id FROM public.inventory WHERE name_ar='بطاطس' LIMIT 1),'deduct_qty',120,'deduct_unit','g')
      );
      v_ingredients_json := jsonb_build_array(
        jsonb_build_object('inventory_id',(SELECT id FROM public.inventory WHERE name_ar='دجاج' LIMIT 1),'weight',160,'unit','g'),
        jsonb_build_object('inventory_id',(SELECT id FROM public.inventory WHERE name_ar='خبز برجر' LIMIT 1),'weight',1,'unit','pcs'),
        jsonb_build_object('inventory_id',(SELECT id FROM public.inventory WHERE name_ar='جبنة شيدر' LIMIT 1),'weight',25,'unit','g'),
        jsonb_build_object('inventory_id',(SELECT id FROM public.inventory WHERE name_ar='خس كابوتشا' LIMIT 1),'weight',25,'unit','g','optional',true),
        jsonb_build_object('inventory_id',(SELECT id FROM public.inventory WHERE name_ar='زيت قلى نباتي' LIMIT 1),'weight',25,'unit','ml'),
        jsonb_build_object('inventory_id',(SELECT id FROM public.inventory WHERE name_ar='صوص سيزر ومايونيز' LIMIT 1),'weight',25,'unit','g')
      );
    ELSIF v_menu_rec.name_ar = 'ساندويتش شاورما' THEN
      v_prep := 'يُقطع الدجاج المشوي شرائح رفيعة ويُلف في عيش الصاج مع الطحينة والطماطم والبصل ويُكبس على التوستر.';
      v_allergens := '["غلوتين (قمح)", "سمسم"]'::jsonb;
      v_quick_opts := '[{"id":"no_onion","label_ar":"بدون بصل","label_en":"No Onion","group":"exclude"},{"id":"extra_spicy","label_ar":"حار","label_en":"Spicy","group":"spice"}]'::jsonb;
      v_additions_json := jsonb_build_array(
        jsonb_build_object('id','extra_tahini','name_ar','طحينة إضافية','price',0.75,'inventory_id',(SELECT id FROM public.inventory WHERE name_ar='طحينة سمسم' LIMIT 1),'deduct_qty',30,'deduct_unit','g')
      );
      v_ingredients_json := jsonb_build_array(
        jsonb_build_object('inventory_id',(SELECT id FROM public.inventory WHERE name_ar='دجاج' LIMIT 1),'weight',150,'unit','g'),
        jsonb_build_object('inventory_id',(SELECT id FROM public.inventory WHERE name_ar='عيش صاج / شاورما' LIMIT 1),'weight',1,'unit','pcs'),
        jsonb_build_object('inventory_id',(SELECT id FROM public.inventory WHERE name_ar='طحينة سمسم' LIMIT 1),'weight',25,'unit','g'),
        jsonb_build_object('inventory_id',(SELECT id FROM public.inventory WHERE name_ar='طماطم طازجة' LIMIT 1),'weight',30,'unit','g','optional',true),
        jsonb_build_object('inventory_id',(SELECT id FROM public.inventory WHERE name_ar='بصل طازج' LIMIT 1),'weight',20,'unit','g','optional',true)
      );
    ELSIF v_menu_rec.name_ar = 'مشاوي مشكل' THEN
      v_req_oven := true;
      v_prep := 'تُشوى أسياخ الكباب وقطع الدجاج على الفحم 12-15 دقيقة وتُقدم فوق الخبز مع البصل والطماطم المشوية.';
      v_allergens := '["غلوتين (خبز التقديم)", "سمسم (طحينة)"]'::jsonb;
      v_ingredients_json := jsonb_build_array(
        jsonb_build_object('inventory_id',(SELECT id FROM public.inventory WHERE name_ar='لحم مفروم' LIMIT 1),'weight',200,'unit','g'),
        jsonb_build_object('inventory_id',(SELECT id FROM public.inventory WHERE name_ar='دجاج' LIMIT 1),'weight',180,'unit','g'),
        jsonb_build_object('inventory_id',(SELECT id FROM public.inventory WHERE name_ar='طماطم طازجة' LIMIT 1),'weight',60,'unit','g'),
        jsonb_build_object('inventory_id',(SELECT id FROM public.inventory WHERE name_ar='بصل طازج' LIMIT 1),'weight',50,'unit','g'),
        jsonb_build_object('inventory_id',(SELECT id FROM public.inventory WHERE name_ar='عيش صاج / شاورما' LIMIT 1),'weight',1,'unit','pcs')
      );
    ELSIF v_menu_rec.name_ar = 'كباب لحم' THEN
      v_req_oven := true;
      v_prep := 'يُشوى الكباب على الفحم الساخن مع التقليب المستمر 10-12 دقيقة ويُقدم مع البصل والطماطم والخبز.';
      v_allergens := '["غلوتين (خبز التقديم)"]'::jsonb;
      v_ingredients_json := jsonb_build_array(
        jsonb_build_object('inventory_id',(SELECT id FROM public.inventory WHERE name_ar='لحم مفروم' LIMIT 1),'weight',250,'unit','g'),
        jsonb_build_object('inventory_id',(SELECT id FROM public.inventory WHERE name_ar='بصل طازج' LIMIT 1),'weight',40,'unit','g'),
        jsonb_build_object('inventory_id',(SELECT id FROM public.inventory WHERE name_ar='طماطم طازجة' LIMIT 1),'weight',50,'unit','g'),
        jsonb_build_object('inventory_id',(SELECT id FROM public.inventory WHERE name_ar='عيش صاج / شاورما' LIMIT 1),'weight',1,'unit','pcs')
      );
    ELSIF v_menu_rec.name_ar = 'فراخ مشوية' THEN
      v_req_oven := true;
      v_prep := 'تُشوى الفراخ المتبلة بالفرن أو الفحم 18-22 دقيقة حتى تمام النضج والتحمير.';
      v_allergens := '[]'::jsonb;
      v_ingredients_json := jsonb_build_array(
        jsonb_build_object('inventory_id',(SELECT id FROM public.inventory WHERE name_ar='دجاج' LIMIT 1),'weight',300,'unit','g'),
        jsonb_build_object('inventory_id',(SELECT id FROM public.inventory WHERE name_ar='طماطم طازجة' LIMIT 1),'weight',40,'unit','g'),
        jsonb_build_object('inventory_id',(SELECT id FROM public.inventory WHERE name_ar='بصل طازج' LIMIT 1),'weight',35,'unit','g'),
        jsonb_build_object('inventory_id',(SELECT id FROM public.inventory WHERE name_ar='زيت زيتون' LIMIT 1),'weight',10,'unit','ml')
      );
    ELSIF v_menu_rec.name_ar = 'سلطة سيزر بالدجاج' THEN
      v_prep := 'يُخلط الخس مع صوص السيزر وتُضاف شرائح الدجاج المشوي والخبز المحمص.';
      v_allergens := '["بيض", "ألبان", "غلوتين"]'::jsonb;
      v_ingredients_json := jsonb_build_array(
        jsonb_build_object('inventory_id',(SELECT id FROM public.inventory WHERE name_ar='خس كابوتشا' LIMIT 1),'weight',120,'unit','g'),
        jsonb_build_object('inventory_id',(SELECT id FROM public.inventory WHERE name_ar='دجاج' LIMIT 1),'weight',100,'unit','g'),
        jsonb_build_object('inventory_id',(SELECT id FROM public.inventory WHERE name_ar='صوص سيزر ومايونيز' LIMIT 1),'weight',40,'unit','g')
      );
    ELSIF v_menu_rec.name_ar = 'سلطة يونانية' THEN
      v_prep := 'تُقطع مكعبات الخيار والطماطم والفلفل وتُضاف شرائح الزيتون والبصل وجبنة الفيتا وزيت الزيتون.';
      v_allergens := '["ألبان (جبنة فيتا)"]'::jsonb;
      v_ingredients_json := jsonb_build_array(
        jsonb_build_object('inventory_id',(SELECT id FROM public.inventory WHERE name_ar='طماطم طازجة' LIMIT 1),'weight',80,'unit','g'),
        jsonb_build_object('inventory_id',(SELECT id FROM public.inventory WHERE name_ar='خيار طازج' LIMIT 1),'weight',80,'unit','g'),
        jsonb_build_object('inventory_id',(SELECT id FROM public.inventory WHERE name_ar='فلفل رومي' LIMIT 1),'weight',40,'unit','g'),
        jsonb_build_object('inventory_id',(SELECT id FROM public.inventory WHERE name_ar='بصل طازج' LIMIT 1),'weight',20,'unit','g','optional',true),
        jsonb_build_object('inventory_id',(SELECT id FROM public.inventory WHERE name_ar='زيتون أسود شرائح' LIMIT 1),'weight',30,'unit','g'),
        jsonb_build_object('inventory_id',(SELECT id FROM public.inventory WHERE name_ar='جبنة فيتا' LIMIT 1),'weight',50,'unit','g'),
        jsonb_build_object('inventory_id',(SELECT id FROM public.inventory WHERE name_ar='زيت زيتون' LIMIT 1),'weight',15,'unit','ml')
      );
    ELSIF v_menu_rec.name_ar = 'حمص بالطحينة' THEN
      v_prep := 'يُهرس الحمص ناعماً مع الطحينة وزيت الزيتون ويُزين برشة زيت زيتون.';
      v_allergens := '["سمسم"]'::jsonb;
      v_ingredients_json := jsonb_build_array(
        jsonb_build_object('inventory_id',(SELECT id FROM public.inventory WHERE name_ar='حمص مسلوق' LIMIT 1),'weight',140,'unit','g'),
        jsonb_build_object('inventory_id',(SELECT id FROM public.inventory WHERE name_ar='طحينة سمسم' LIMIT 1),'weight',40,'unit','g'),
        jsonb_build_object('inventory_id',(SELECT id FROM public.inventory WHERE name_ar='زيت زيتون' LIMIT 1),'weight',15,'unit','ml')
      );
    ELSIF v_menu_rec.name_ar = 'بابا غنوج' THEN
      v_prep := 'يُخلط الباذنجان المشوي مع الطحينة وزيت الزيتون والطماطم المفرومة.';
      v_allergens := '["سمسم"]'::jsonb;
      v_ingredients_json := jsonb_build_array(
        jsonb_build_object('inventory_id',(SELECT id FROM public.inventory WHERE name_ar='باذنجان مشوي' LIMIT 1),'weight',150,'unit','g'),
        jsonb_build_object('inventory_id',(SELECT id FROM public.inventory WHERE name_ar='طحينة سمسم' LIMIT 1),'weight',35,'unit','g'),
        jsonb_build_object('inventory_id',(SELECT id FROM public.inventory WHERE name_ar='زيت زيتون' LIMIT 1),'weight',15,'unit','ml'),
        jsonb_build_object('inventory_id',(SELECT id FROM public.inventory WHERE name_ar='طماطم طازجة' LIMIT 1),'weight',25,'unit','g')
      );
    ELSIF v_menu_rec.name_ar = 'بطاطس مقلية' THEN
      v_prep := 'تُقلى البطاطس في زيت ساخن 175°م لمدة 4 دقائق حتى تصبح مقرمشة.';
      v_allergens := '[]'::jsonb;
      v_ingredients_json := jsonb_build_array(
        jsonb_build_object('inventory_id',(SELECT id FROM public.inventory WHERE name_ar='بطاطس' LIMIT 1),'weight',220,'unit','g'),
        jsonb_build_object('inventory_id',(SELECT id FROM public.inventory WHERE name_ar='زيت قلى نباتي' LIMIT 1),'weight',25,'unit','ml')
      );
    ELSIF v_menu_rec.name_ar = 'كوكاكولا' THEN
      v_prep := 'تُقدم مبردة من الثلاجة مع ثلج وكوب حسب اختيار العميل.';
      v_quick_opts := '[{"id":"drink_chilled","label_ar":"بارد جداً","label_en":"Chilled","group":"temp"},{"id":"drink_ice","label_ar":"مع ثلج","label_en":"With Ice","group":"ice"},{"id":"drink_no_ice","label_ar":"بدون ثلج","label_en":"No Ice","group":"ice"},{"id":"drink_cup","label_ar":"مع كوب","label_en":"With Cup","group":"serving"}]'::jsonb;
      v_ingredients_json := jsonb_build_array(
        jsonb_build_object('inventory_id',(SELECT id FROM public.inventory WHERE name_ar='كوكاكولا' LIMIT 1),'weight',1,'unit','can')
      );
    ELSIF v_menu_rec.name_ar = 'عصير برتقال طازج' THEN
      v_prep := 'يُعصر البرتقال الطازج فوراً ويُقدم مبرداً مع السكر/الثلج حسب الاختيار.';
      v_quick_opts := '[{"id":"drink_no_ice","label_ar":"بدون ثلج","label_en":"No Ice","group":"ice"},{"id":"drink_ice","label_ar":"مع ثلج","label_en":"With Ice","group":"ice"},{"id":"sugar_none","label_ar":"بدون سكر","label_en":"No Sugar","group":"sugar"}]'::jsonb;
      v_ingredients_json := jsonb_build_array(
        jsonb_build_object('inventory_id',(SELECT id FROM public.inventory WHERE name_ar='برتقال للعصير' LIMIT 1),'weight',350,'unit','g'),
        jsonb_build_object('inventory_id',(SELECT id FROM public.inventory WHERE name_ar='سكر أبيض' LIMIT 1),'weight',15,'unit','g','optional',true)
      );
    ELSIF v_menu_rec.name_ar = 'شاي بالنعناع' THEN
      v_prep := 'يُغلى الماء وتُضاف أوراق الشاي والنعناع الطازج ويُقدم مع السكر المختار.';
      v_quick_opts := '[{"id":"sugar_none","label_ar":"بدون سكر","label_en":"No Sugar","group":"sugar"},{"id":"sugar_medium","label_ar":"سكر مضبوط","label_en":"Medium Sugar","group":"sugar"},{"id":"sugar_extra","label_ar":"سكر زيادة","label_en":"Extra Sugar","group":"sugar"}]'::jsonb;
      v_ingredients_json := jsonb_build_array(
        jsonb_build_object('inventory_id',(SELECT id FROM public.inventory WHERE name_ar='شاي أسود فاخر' LIMIT 1),'weight',4,'unit','g'),
        jsonb_build_object('inventory_id',(SELECT id FROM public.inventory WHERE name_ar='نعناع طازج' LIMIT 1),'weight',6,'unit','g'),
        jsonb_build_object('inventory_id',(SELECT id FROM public.inventory WHERE name_ar='سكر أبيض' LIMIT 1),'weight',15,'unit','g','optional',true)
      );
    ELSIF v_menu_rec.name_ar = 'قهوة تركي' THEN
      v_prep := 'تُغلى في الكنكة على نار هادئة مع درجة السكر المختارة.';
      v_quick_opts := '[{"id":"sugar_none","label_ar":"سادة (بدون سكر)","label_en":"No Sugar","group":"sugar"},{"id":"sugar_medium","label_ar":"مضبوط","label_en":"Medium Sugar","group":"sugar"},{"id":"sugar_extra","label_ar":"زيادة","label_en":"Extra Sugar","group":"sugar"}]'::jsonb;
      v_ingredients_json := jsonb_build_array(
        jsonb_build_object('inventory_id',(SELECT id FROM public.inventory WHERE name_ar='بن قهوة تركي' LIMIT 1),'weight',12,'unit','g'),
        jsonb_build_object('inventory_id',(SELECT id FROM public.inventory WHERE name_ar='سكر أبيض' LIMIT 1),'weight',10,'unit','g','optional',true)
      );
    ELSIF v_menu_rec.name_ar = 'كنافة بالقشطة' THEN
      v_req_oven := true;
      v_prep := 'تُحشى الكنافة بالقشطة وتُسقى بالسمن وتُخبز بالفرن ثم يُصب الشربات الدافئ.';
      v_allergens := '["غلوتين (قمح)", "ألبان"]'::jsonb;
      v_ingredients_json := jsonb_build_array(
        jsonb_build_object('inventory_id',(SELECT id FROM public.inventory WHERE name_ar='عجينة كنافة' LIMIT 1),'weight',120,'unit','g'),
        jsonb_build_object('inventory_id',(SELECT id FROM public.inventory WHERE name_ar='قشطة بلدي' LIMIT 1),'weight',80,'unit','g'),
        jsonb_build_object('inventory_id',(SELECT id FROM public.inventory WHERE name_ar='سمن طبيعي' LIMIT 1),'weight',25,'unit','g'),
        jsonb_build_object('inventory_id',(SELECT id FROM public.inventory WHERE name_ar='شربات حلويات (قطر)' LIMIT 1),'weight',40,'unit','ml')
      );
    ELSIF v_menu_rec.name_ar = 'أم علي' THEN
      v_req_oven := true;
      v_prep := 'تُوضع الرقائق في الطاجن ويُضاف الحليب المغلي والقشطة وتُحمر بالفرن 8 دقائق.';
      v_allergens := '["غلوتين (قمح)", "ألبان"]'::jsonb;
      v_ingredients_json := jsonb_build_array(
        jsonb_build_object('inventory_id',(SELECT id FROM public.inventory WHERE name_ar='رقائق جلاش / ميل فاي' LIMIT 1),'weight',90,'unit','g'),
        jsonb_build_object('inventory_id',(SELECT id FROM public.inventory WHERE name_ar='حليب طازج' LIMIT 1),'weight',200,'unit','ml'),
        jsonb_build_object('inventory_id',(SELECT id FROM public.inventory WHERE name_ar='قشطة بلدي' LIMIT 1),'weight',50,'unit','g'),
        jsonb_build_object('inventory_id',(SELECT id FROM public.inventory WHERE name_ar='سكر أبيض' LIMIT 1),'weight',25,'unit','g')
      );
    ELSIF v_menu_rec.name_ar = 'بسبوسة' THEN
      v_req_oven := true;
      v_prep := 'يُخبز خليط السميد والسمن بالفرن حتى الاحمرار ثم يُسقى بالشربات الساخن.';
      v_allergens := '["غلوتين (قمح)", "ألبان"]'::jsonb;
      v_ingredients_json := jsonb_build_array(
        jsonb_build_object('inventory_id',(SELECT id FROM public.inventory WHERE name_ar='سميد بسبوسة' LIMIT 1),'weight',110,'unit','g'),
        jsonb_build_object('inventory_id',(SELECT id FROM public.inventory WHERE name_ar='سمن طبيعي' LIMIT 1),'weight',25,'unit','g'),
        jsonb_build_object('inventory_id',(SELECT id FROM public.inventory WHERE name_ar='حليب طازج' LIMIT 1),'weight',40,'unit','ml'),
        jsonb_build_object('inventory_id',(SELECT id FROM public.inventory WHERE name_ar='سكر أبيض' LIMIT 1),'weight',20,'unit','g'),
        jsonb_build_object('inventory_id',(SELECT id FROM public.inventory WHERE name_ar='شربات حلويات (قطر)' LIMIT 1),'weight',40,'unit','ml')
      );
    ELSIF v_menu_rec.name_ar ILIKE '%ماء%' OR v_menu_rec.name_ar ILIKE '%مياه%' THEN
      v_prep := 'تُقدم زجاجة المياه حسب درجة الحرارة المطلوبة (بارد / درجة الغرفة / ساخن) ومع كوب أو ثلج حسب الطلب.';
      v_quick_opts := '[{"id":"water_cold","label_ar":"بارد","label_en":"Cold","group":"temp"},{"id":"water_room","label_ar":"درجة حرارة الغرفة","label_en":"Room Temperature","group":"temp"},{"id":"water_warm","label_ar":"ساخن","label_en":"Warm","group":"temp"},{"id":"water_cup","label_ar":"مع كوب","label_en":"With Cup","group":"serving"},{"id":"water_ice","label_ar":"مع ثلج","label_en":"With Ice","group":"ice"},{"id":"water_no_ice","label_ar":"بدون ثلج","label_en":"No Ice","group":"ice"}]'::jsonb;
      v_ingredients_json := jsonb_build_array(
        jsonb_build_object('inventory_id',(SELECT id FROM public.inventory WHERE name_ar='مياه معدنية صغيرة' LIMIT 1),'weight',1,'unit','bottle')
      );
    END IF;

    IF jsonb_array_length(v_ingredients_json) > 0 THEN
      -- Strip any unresolved null inventory_ids safely
      v_ingredients_json := COALESCE((
        SELECT jsonb_agg(elem)
        FROM jsonb_array_elements(v_ingredients_json) AS elem
        WHERE NULLIF(elem->>'inventory_id', '') IS NOT NULL
      ), '[]'::jsonb);

      IF jsonb_array_length(v_ingredients_json) > 0 THEN
        UPDATE public.menu_items
        SET ingredients = CASE WHEN jsonb_typeof(ingredients) = 'array' AND jsonb_array_length(ingredients) > 0 THEN ingredients ELSE v_ingredients_json END,
            inventory_tracking = 'recipe_required',
            requires_oven = COALESCE(requires_oven, false) OR v_req_oven,
            prep_instructions = COALESCE(prep_instructions, v_prep),
            allergens = CASE WHEN jsonb_typeof(allergens) = 'array' AND jsonb_array_length(allergens) > 0 THEN allergens ELSE v_allergens END,
            quick_options = CASE WHEN jsonb_typeof(quick_options) = 'array' AND jsonb_array_length(quick_options) > 0 THEN quick_options ELSE v_quick_opts END,
            additions = CASE WHEN jsonb_typeof(additions) = 'array' AND jsonb_array_length(additions) > 0 THEN additions ELSE v_additions_json END
        WHERE id = v_menu_rec.id;

        INSERT INTO public.recipes (menu_item_id, notes)
        VALUES (v_menu_rec.id, v_prep)
        ON CONFLICT (menu_item_id) DO UPDATE SET
          notes = COALESCE(public.recipes.notes, EXCLUDED.notes),
          updated_at = now()
        RETURNING id INTO v_recipe_id;

        -- Only insert ingredients into recipe_ingredients if none exist yet for that recipe
        IF NOT EXISTS (SELECT 1 FROM public.recipe_ingredients WHERE recipe_id = v_recipe_id) THEN
          FOR v_ing IN SELECT * FROM jsonb_array_elements(v_ingredients_json) LOOP
            INSERT INTO public.recipe_ingredients (
              recipe_id, inventory_id, quantity, weight, unit, optional
            ) VALUES (
              v_recipe_id,
              (v_ing->>'inventory_id')::uuid,
              (v_ing->>'weight')::numeric,
              (v_ing->>'weight')::numeric,
              COALESCE(v_ing->>'unit', 'pcs'),
              COALESCE((v_ing->>'optional')::boolean, false)
            )
            ON CONFLICT (recipe_id, inventory_id) DO NOTHING;
          END LOOP;
        END IF;
      END IF;
    END IF;
  END LOOP;
END $$;

COMMIT;
