DO $$
DECLARE
  v_definition text;
BEGIN
  SELECT pg_get_functiondef(p.oid)
  INTO v_definition
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'run_e2e_inventory_test'
    AND pg_get_function_identity_arguments(p.oid) = '';

  v_definition := replace(
    v_definition,
    'INSERT INTO public.menu_items (name_ar, price, category_id, is_available)',
    'INSERT INTO public.menu_items (name_ar, price, category_id, is_available, inventory_tracking)'
  );
  v_definition := replace(
    v_definition,
    'VALUES (''صنف اختبار دورة الطلب'', 25, v_category_id, true)',
    'VALUES (''صنف اختبار دورة الطلب'', 25, v_category_id, true, ''recipe_required'')'
  );

  EXECUTE v_definition;
END $$;