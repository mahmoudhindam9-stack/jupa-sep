-- Restore the intended least-privilege grants for Developer Studio RPCs.
-- Some environments may have the functions but lack EXECUTE for authenticated.
-- Keep anon and PUBLIC revoked: only authenticated clients may invoke these RPCs.
BEGIN;

DO $repair_studio_rpc_grants$
BEGIN
  IF to_regprocedure('public.developer_studio_check_draft_sync(text,text)') IS NULL THEN
    RAISE EXCEPTION
      'Missing public.developer_studio_check_draft_sync(text,text). Apply 20261015100000_studio_local_first_sync_rpcs.sql first.';
  END IF;

  REVOKE ALL ON FUNCTION public.developer_studio_check_draft_sync(TEXT, TEXT) FROM PUBLIC, anon;
  GRANT EXECUTE ON FUNCTION public.developer_studio_check_draft_sync(TEXT, TEXT) TO authenticated;

  IF to_regprocedure('public.developer_studio_save_draft(text,text,text,integer,integer,jsonb,jsonb,jsonb)') IS NOT NULL THEN
    REVOKE ALL ON FUNCTION public.developer_studio_save_draft(TEXT, TEXT, TEXT, INTEGER, INTEGER, JSONB, JSONB, JSONB) FROM PUBLIC, anon;
    GRANT EXECUTE ON FUNCTION public.developer_studio_save_draft(TEXT, TEXT, TEXT, INTEGER, INTEGER, JSONB, JSONB, JSONB) TO authenticated;
  END IF;

  IF to_regprocedure('public.developer_studio_access_status()') IS NOT NULL THEN
    REVOKE ALL ON FUNCTION public.developer_studio_access_status() FROM PUBLIC, anon;
    GRANT EXECUTE ON FUNCTION public.developer_studio_access_status() TO authenticated;
  END IF;

  IF to_regprocedure('public.can_manage_developer_studio()') IS NOT NULL THEN
    REVOKE ALL ON FUNCTION public.can_manage_developer_studio() FROM PUBLIC, anon;
    GRANT EXECUTE ON FUNCTION public.can_manage_developer_studio() TO authenticated;
  END IF;

  IF to_regprocedure('public.publish_studio_configuration(integer,integer,jsonb,jsonb,jsonb,text)') IS NOT NULL THEN
    REVOKE ALL ON FUNCTION public.publish_studio_configuration(INTEGER, INTEGER, JSONB, JSONB, JSONB, TEXT) FROM PUBLIC, anon;
    GRANT EXECUTE ON FUNCTION public.publish_studio_configuration(INTEGER, INTEGER, JSONB, JSONB, JSONB, TEXT) TO authenticated;
  END IF;
END;
$repair_studio_rpc_grants$;

COMMIT;
