-- Re-apply the least-privilege EXECUTE grants for Developer Studio RPCs.
-- Kept as a newer migration to repair environments where an earlier grant migration
-- was committed to GitHub but never applied, or where grants drifted afterward.
BEGIN;

DO $repair_studio_sync_grants$
BEGIN
  IF to_regprocedure('public.developer_studio_check_draft_sync(text,text)') IS NOT NULL THEN
    REVOKE ALL ON FUNCTION public.developer_studio_check_draft_sync(TEXT, TEXT) FROM PUBLIC, anon;
    GRANT EXECUTE ON FUNCTION public.developer_studio_check_draft_sync(TEXT, TEXT) TO authenticated;
  END IF;

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
$repair_studio_sync_grants$;

COMMIT;
