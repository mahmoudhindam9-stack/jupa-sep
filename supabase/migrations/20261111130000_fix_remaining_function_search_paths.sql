-- Pin search_path on the remaining legacy public functions flagged by the security advisor.
ALTER FUNCTION public.normalize_unit(TEXT)
  SET search_path = public, auth, extensions, pg_temp;

ALTER FUNCTION public.convert_to_inventory_unit(NUMERIC, TEXT, TEXT)
  SET search_path = public, auth, extensions, pg_temp;

ALTER FUNCTION public.handle_order_inventory_changes()
  SET search_path = public, auth, extensions, pg_temp;
