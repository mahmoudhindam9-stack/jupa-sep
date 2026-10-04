CREATE OR REPLACE FUNCTION public.run_e2e_inventory_test()
RETURNS jsonb
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_category_id uuid;
  v_inventory_id uuid;
  v_menu_item_id uuid;
  v_recipe_id uuid;
  v_order_id uuid;
  v_initial numeric;
  v_pending numeric;
  v_preparing numeric;
  v_double_preparing numeric;
  v_cancelled numeric;
  v_double_cancelled numeric;
  v_result jsonb;
BEGIN
  INSERT INTO public.menu_categories (name_ar, sort_order)
  VALUES ('قسم اختبار دورة الطلب', 999)
  RETURNING id INTO v_category_id;

  INSERT INTO public.inventory (name_ar, quantity, min_level, unit, cost)
  VALUES ('مكون اختبار دورة الطلب', 100, 10, 'kg', 1)
  RETURNING id, quantity INTO v_inventory_id, v_initial;

  INSERT INTO public.menu_items (name_ar, price, category_id, is_available, inventory_tracking)
  VALUES ('صنف اختبار دورة الطلب', 25, v_category_id, true, 'recipe_required')
  RETURNING id INTO v_menu_item_id;

  INSERT INTO public.recipes (menu_item_id, notes)
  VALUES (v_menu_item_id, 'اختبار آلي')
  RETURNING id INTO v_recipe_id;

  INSERT INTO public.recipe_ingredients (recipe_id, inventory_id, quantity, weight, unit, optional)
  VALUES (v_recipe_id, v_inventory_id, 5, 5, 'kg', false);

  INSERT INTO public.orders (subtotal, tax, total, payment_method, order_type, status, items)
  VALUES (
    50, 0, 50, 'cash', 'dine_in', 'pending',
    jsonb_build_array(jsonb_build_object(
      'id', v_menu_item_id,
      'menu_item_id', v_menu_item_id,
      'name_ar', 'صنف اختبار دورة الطلب',
      'price', 25,
      'quantity', 2
    ))
  )
  RETURNING id INTO v_order_id;

  SELECT quantity INTO v_pending FROM public.inventory WHERE id = v_inventory_id;
  v_result := public.start_order_preparing(v_order_id, false);
  SELECT quantity INTO v_preparing FROM public.inventory WHERE id = v_inventory_id;
  v_result := public.start_order_preparing(v_order_id, false);
  SELECT quantity INTO v_double_preparing FROM public.inventory WHERE id = v_inventory_id;
  v_result := public.cancel_order(v_order_id);
  SELECT quantity INTO v_cancelled FROM public.inventory WHERE id = v_inventory_id;
  v_result := public.cancel_order(v_order_id);
  SELECT quantity INTO v_double_cancelled FROM public.inventory WHERE id = v_inventory_id;

  DELETE FROM public.orders WHERE id = v_order_id;
  DELETE FROM public.recipe_ingredients WHERE recipe_id = v_recipe_id;
  DELETE FROM public.recipes WHERE id = v_recipe_id;
  DELETE FROM public.menu_items WHERE id = v_menu_item_id;
  DELETE FROM public.inventory WHERE id = v_inventory_id;
  DELETE FROM public.menu_categories WHERE id = v_category_id;

  RETURN jsonb_build_object(
    'success', v_initial = v_pending
      AND v_preparing = v_initial - 10
      AND v_double_preparing = v_preparing
      AND v_cancelled = v_initial
      AND v_double_cancelled = v_cancelled,
    'initial_stock', v_initial,
    'stock_after_pending', v_pending,
    'stock_after_preparing', v_preparing,
    'stock_after_double_preparing', v_double_preparing,
    'stock_after_cancelled', v_cancelled,
    'stock_after_double_cancelled', v_double_cancelled
  );
EXCEPTION WHEN OTHERS THEN
  DELETE FROM public.orders WHERE id = v_order_id;
  DELETE FROM public.menu_items WHERE id = v_menu_item_id;
  DELETE FROM public.inventory WHERE id = v_inventory_id;
  DELETE FROM public.menu_categories WHERE id = v_category_id;
  RETURN jsonb_build_object('success', false, 'error', SQLERRM, 'detail', SQLSTATE);
END;
$$ LANGUAGE plpgsql;

REVOKE EXECUTE ON FUNCTION public.run_e2e_inventory_test() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.run_e2e_inventory_test() TO anon, authenticated;