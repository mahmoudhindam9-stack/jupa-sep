-- Repair Developer Studio RLS without granting editor access to ordinary users.
-- Supports developer_options as either a boolean profile column or a permissions JSON key.
BEGIN;

ALTER TABLE public.studio_published_configs
  ADD COLUMN IF NOT EXISTS dom_edits JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.studio_drafts
  ADD COLUMN IF NOT EXISTS dom_edits JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE OR REPLACE FUNCTION public.can_manage_developer_studio()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1
      FROM public.profiles AS p
     WHERE p.id = auth.uid()
       AND (
         lower(COALESCE(to_jsonb(p)->>'role', '')) IN ('admin', 'super_admin')
         OR lower(COALESCE(to_jsonb(p)->>'developer_options', 'false')) = 'true'
         OR COALESCE(to_jsonb(p)->'permissions', '{}'::jsonb)
              @> '{"developer_options": true}'::jsonb
         OR COALESCE(to_jsonb(p)->'permissions', '{}'::jsonb)
              @> '{"super_admin_full_access": true}'::jsonb
       )
  );
$$;

REVOKE ALL ON FUNCTION public.can_manage_developer_studio() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_manage_developer_studio() TO authenticated;

-- Diagnose the CURRENT Supabase session using the same profile check as RLS.
-- This function only returns the caller's own profile status.
CREATE OR REPLACE FUNCTION public.developer_studio_access_status()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_profile JSONB;
  v_role TEXT := '';
  v_developer_options BOOLEAN := false;
  v_allowed BOOLEAN := false;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'authenticated', false,
      'profile_found', false,
      'developer_options', false,
      'allowed', false,
      'reason', 'no_authenticated_session'
    );
  END IF;

  SELECT to_jsonb(p)
    INTO v_profile
    FROM public.profiles AS p
   WHERE p.id = v_user_id
   LIMIT 1;

  IF v_profile IS NULL THEN
    RETURN jsonb_build_object(
      'authenticated', true,
      'user_id', v_user_id,
      'profile_found', false,
      'developer_options', false,
      'allowed', false,
      'reason', 'profile_missing'
    );
  END IF;

  v_role := lower(COALESCE(v_profile->>'role', ''));
  v_developer_options :=
    lower(COALESCE(v_profile->>'developer_options', 'false')) = 'true'
    OR COALESCE(v_profile->'permissions', '{}'::jsonb) @> '{"developer_options": true}'::jsonb
    OR COALESCE(v_profile->'permissions', '{}'::jsonb) @> '{"super_admin_full_access": true}'::jsonb;
  v_allowed := v_role IN ('admin', 'super_admin') OR v_developer_options;

  RETURN jsonb_build_object(
    'authenticated', true,
    'user_id', v_user_id,
    'profile_found', true,
    'role', v_role,
    'developer_options', v_developer_options,
    'allowed', v_allowed,
    'reason', CASE
      WHEN v_allowed THEN 'authorized'
      ELSE 'missing_developer_studio_permission'
    END
  );
END;
$$;

REVOKE ALL ON FUNCTION public.developer_studio_access_status() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.developer_studio_access_status() TO authenticated;

-- Remove old/overly broad policies, including those created by earlier migrations.
DO $$
DECLARE
  v_policy RECORD;
BEGIN
  FOR v_policy IN
    SELECT policyname, tablename
      FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename IN ('studio_published_configs', 'studio_drafts', 'studio_history')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', v_policy.policyname, v_policy.tablename);
  END LOOP;
END;
$$;

ALTER TABLE public.studio_published_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.studio_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.studio_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY studio_published_public_read
  ON public.studio_published_configs
  FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY studio_drafts_admin_access
  ON public.studio_drafts
  FOR ALL TO authenticated
  USING (public.can_manage_developer_studio())
  WITH CHECK (public.can_manage_developer_studio());

CREATE POLICY studio_history_admin_read
  ON public.studio_history
  FOR SELECT TO authenticated
  USING (public.can_manage_developer_studio());

REVOKE ALL ON public.studio_published_configs FROM anon, authenticated;
GRANT SELECT ON public.studio_published_configs TO anon, authenticated;

REVOKE ALL ON public.studio_drafts FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.studio_drafts TO authenticated;

REVOKE ALL ON public.studio_history FROM anon, authenticated;
GRANT SELECT ON public.studio_history TO authenticated;

-- Enable Supabase Realtime delivery for Studio row changes where supported.
-- RLS still determines which authenticated clients can receive each row.
DO $
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
       WHERE pubname = 'supabase_realtime'
         AND schemaname = 'public'
         AND tablename = 'studio_drafts'
    ) THEN
      EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.studio_drafts';
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
       WHERE pubname = 'supabase_realtime'
         AND schemaname = 'public'
         AND tablename = 'studio_published_configs'
    ) THEN
      EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.studio_published_configs';
    END IF;
  END IF;
END;
$;

COMMIT;
