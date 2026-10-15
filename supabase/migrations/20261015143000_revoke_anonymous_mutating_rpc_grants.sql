-- Undo anonymous/public EXECUTE grants left by historical development migrations.
-- These RPCs can change order state, inventory quantities, or warehouse records.
-- Keep the signed-in application path available; authorization inside these RPCs
-- should continue to be reviewed separately for per-permission enforcement.
BEGIN;

DO $restrict_mutating_rpc_grants$
BEGIN
  IF to_regprocedure('public.start_order_preparing(uuid,boolean)') IS NOT NULL THEN
    REVOKE ALL ON FUNCTION public.start_order_preparing(uuid, boolean) FROM PUBLIC, anon;
    GRANT EXECUTE ON FUNCTION public.start_order_preparing(uuid, boolean) TO authenticated;
  END IF;

  IF to_regprocedure('public.cancel_order(uuid)') IS NOT NULL THEN
    REVOKE ALL ON FUNCTION public.cancel_order(uuid) FROM PUBLIC, anon;
    GRANT EXECUTE ON FUNCTION public.cancel_order(uuid) TO authenticated;
  END IF;

  IF to_regprocedure('public.process_order_inventory(uuid,boolean)') IS NOT NULL THEN
    REVOKE ALL ON FUNCTION public.process_order_inventory(uuid, boolean) FROM PUBLIC, anon;
    GRANT EXECUTE ON FUNCTION public.process_order_inventory(uuid, boolean) TO authenticated;
  END IF;

  IF to_regprocedure('public.process_order_inventory(uuid,boolean,uuid)') IS NOT NULL THEN
    REVOKE ALL ON FUNCTION public.process_order_inventory(uuid, boolean, uuid) FROM PUBLIC, anon;
    GRANT EXECUTE ON FUNCTION public.process_order_inventory(uuid, boolean, uuid) TO authenticated;
  END IF;

  IF to_regprocedure('public.reverse_order_inventory(uuid)') IS NOT NULL THEN
    REVOKE ALL ON FUNCTION public.reverse_order_inventory(uuid) FROM PUBLIC, anon;
    GRANT EXECUTE ON FUNCTION public.reverse_order_inventory(uuid) TO authenticated;
  END IF;

  IF to_regprocedure('public.transfer_inventory(uuid,uuid,uuid,numeric,text,uuid)') IS NOT NULL THEN
    REVOKE ALL ON FUNCTION public.transfer_inventory(uuid, uuid, uuid, numeric, text, uuid) FROM PUBLIC, anon;
    GRANT EXECUTE ON FUNCTION public.transfer_inventory(uuid, uuid, uuid, numeric, text, uuid) TO authenticated;
  END IF;

  IF to_regprocedure('public.create_warehouse_with_options(text,text,text,boolean,boolean)') IS NOT NULL THEN
    REVOKE ALL ON FUNCTION public.create_warehouse_with_options(text, text, text, boolean, boolean) FROM PUBLIC, anon;
    GRANT EXECUTE ON FUNCTION public.create_warehouse_with_options(text, text, text, boolean, boolean) TO authenticated;
  END IF;

  IF to_regprocedure('public.populate_warehouse_default_ingredients(uuid)') IS NOT NULL THEN
    REVOKE ALL ON FUNCTION public.populate_warehouse_default_ingredients(uuid) FROM PUBLIC, anon;
    GRANT EXECUTE ON FUNCTION public.populate_warehouse_default_ingredients(uuid) TO authenticated;
  END IF;
END;
$restrict_mutating_rpc_grants$;

COMMIT;
