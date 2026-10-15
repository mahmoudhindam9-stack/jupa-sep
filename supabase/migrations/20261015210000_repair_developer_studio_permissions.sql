-- Repair Developer Studio synchronization privileges on already-provisioned projects.
-- Idempotent repair for environments where earlier grant migrations were skipped or drifted.
BEGIN;

GRANT USAGE ON SCHEMA public TO authenticated;

DO $studio_permissions$
BEGIN
  IF to_regclass('public.studio_drafts') IS NOT NULL THEN
    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.studio_drafts TO authenticated';
    EXECUTE 'ALTER TABLE public.studio_drafts ENABLE ROW LEVEL SECURITY';
  END IF;
  IF to_regclass('public.studio_published_configs') IS NOT NULL THEN
    EXECUTE 'GRANT SELECT ON TABLE public.studio_published_configs TO anon, authenticated';
  END IF;
  IF to_regclass('public.studio_history') IS NOT NULL THEN
    EXECUTE 'GRANT SELECT ON TABLE public.studio_history TO authenticated';
  END IF;
  IF to_regprocedure('public.can_manage_developer_studio()') IS NOT NULL THEN
    EXECUTE 'REVOKE ALL ON FUNCTION public.can_manage_developer_studio() FROM PUBLIC, anon';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.can_manage_developer_studio() TO authenticated';
  END IF;
  IF to_regprocedure('public.developer_studio_access_status()') IS NOT NULL THEN
    EXECUTE 'REVOKE ALL ON FUNCTION public.developer_studio_access_status() FROM PUBLIC, anon';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.developer_studio_access_status() TO authenticated';
  END IF;
  IF to_regprocedure('public.developer_studio_check_draft_sync(text,text)') IS NOT NULL THEN
    EXECUTE 'REVOKE ALL ON FUNCTION public.developer_studio_check_draft_sync(text,text) FROM PUBLIC, anon';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.developer_studio_check_draft_sync(text,text) TO authenticated';
  END IF;
  IF to_regprocedure('public.developer_studio_save_draft(text,text,text,integer,integer,jsonb,jsonb,jsonb)') IS NOT NULL THEN
    EXECUTE 'REVOKE ALL ON FUNCTION public.developer_studio_save_draft(text,text,text,integer,integer,jsonb,jsonb,jsonb) FROM PUBLIC, anon';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.developer_studio_save_draft(text,text,text,integer,integer,jsonb,jsonb,jsonb) TO authenticated';
  END IF;
  IF to_regprocedure('public.publish_studio_configuration(integer,integer,jsonb,jsonb,jsonb,text)') IS NOT NULL THEN
    EXECUTE 'REVOKE ALL ON FUNCTION public.publish_studio_configuration(integer,integer,jsonb,jsonb,jsonb,text) FROM PUBLIC, anon';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.publish_studio_configuration(integer,integer,jsonb,jsonb,jsonb,text) TO authenticated';
  END IF;
  IF to_regclass('public.studio_drafts') IS NOT NULL
     AND to_regprocedure('public.can_manage_developer_studio()') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS studio_drafts_admin_access ON public.studio_drafts';
    EXECUTE 'CREATE POLICY studio_drafts_admin_access ON public.studio_drafts FOR ALL TO authenticated USING (public.can_manage_developer_studio()) WITH CHECK (public.can_manage_developer_studio())';
  END IF;
END;
$studio_permissions$;

COMMIT;
