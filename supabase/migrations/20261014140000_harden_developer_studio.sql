-- Harden Coding Studio storage and make publication transactional.
ALTER TABLE public.studio_published_configs
  ADD COLUMN IF NOT EXISTS dom_edits JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.studio_drafts
  ADD COLUMN IF NOT EXISTS dom_edits JSONB NOT NULL DEFAULT '{}'::jsonb;

-- Older builds could create multiple rows for the same owner. Keep the newest row
-- before enforcing one authoritative draft per editor owner.
WITH ranked AS (
  SELECT id, row_number() OVER (
    PARTITION BY owner ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST, id
  ) AS rn
  FROM public.studio_drafts
)
DELETE FROM public.studio_drafts d
USING ranked r
WHERE d.id = r.id AND r.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS studio_drafts_owner_uidx
  ON public.studio_drafts (owner);

CREATE OR REPLACE FUNCTION public.can_manage_developer_studio()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND (
        p.role IN ('admin', 'super_admin')
        OR COALESCE(p.permissions, '{}'::jsonb) @> '{"developer_options": true}'::jsonb
        OR COALESCE(p.permissions, '{}'::jsonb) @> '{"super_admin_full_access": true}'::jsonb
      )
  );
$$;

REVOKE ALL ON FUNCTION public.can_manage_developer_studio() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_manage_developer_studio() TO authenticated;

-- Replace all previously-created policies on the three Studio tables.
DO $$
DECLARE
  p RECORD;
BEGIN
  FOR p IN
    SELECT policyname, tablename
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('studio_published_configs', 'studio_drafts', 'studio_history')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', p.policyname, p.tablename);
  END LOOP;
END;
$$;

ALTER TABLE public.studio_published_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.studio_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.studio_history ENABLE ROW LEVEL SECURITY;

-- Published configuration is public-readable so regular app clients can render it.
CREATE POLICY studio_published_public_read
  ON public.studio_published_configs FOR SELECT TO anon, authenticated
  USING (true);

-- Drafts are accessible only to authenticated Studio administrators.
CREATE POLICY studio_drafts_admin_access
  ON public.studio_drafts FOR ALL TO authenticated
  USING (public.can_manage_developer_studio())
  WITH CHECK (public.can_manage_developer_studio());

-- History is read-only to admins from the client. Publication/rollback writes run
-- through the security-definer transaction below.
CREATE POLICY studio_history_admin_read
  ON public.studio_history FOR SELECT TO authenticated
  USING (public.can_manage_developer_studio());

CREATE OR REPLACE FUNCTION public.publish_studio_configuration(
  p_expected_revision INTEGER,
  p_schema_version INTEGER,
  p_pages JSONB,
  p_elements JSONB,
  p_dom_edits JSONB,
  p_summary TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current public.studio_published_configs%ROWTYPE;
  v_new_revision INTEGER;
  v_author TEXT;
  v_published_at TIMESTAMPTZ := now();
BEGIN
  IF NOT public.can_manage_developer_studio() THEN
    RAISE EXCEPTION 'NOT_AUTHORIZED: Developer Studio publishing requires an authenticated administrator.';
  END IF;

  SELECT *
    INTO v_current
    FROM public.studio_published_configs
   WHERE id = 'active'
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'STUDIO_NOT_INITIALIZED: Run the Developer Studio migration first.';
  END IF;

  IF v_current.revision <> p_expected_revision THEN
    RETURN jsonb_build_object(
      'success', false,
      'conflict', true,
      'currentRevision', v_current.revision
    );
  END IF;

  v_new_revision := v_current.revision + 1;
  SELECT COALESCE(NULLIF(p.username, ''), NULLIF(p.full_name, ''), auth.uid()::text)
    INTO v_author
    FROM public.profiles p
   WHERE p.id = auth.uid();
  v_author := COALESCE(v_author, auth.uid()::text);

  INSERT INTO public.studio_history (
    revision, schema_version, published_by, published_at, summary, snapshot
  ) VALUES (
    v_current.revision,
    v_current.schema_version,
    v_current.published_by,
    v_current.published_at,
    v_current.summary,
    jsonb_build_object(
      'pages', v_current.pages,
      'elements', v_current.elements,
      'domEdits', COALESCE(v_current.dom_edits, '{}'::jsonb)
    )
  );

  UPDATE public.studio_published_configs
     SET revision = v_new_revision,
         schema_version = p_schema_version,
         pages = COALESCE(p_pages, '{}'::jsonb),
         elements = COALESCE(p_elements, '{}'::jsonb),
         dom_edits = COALESCE(p_dom_edits, '{}'::jsonb),
         published_by = v_author,
         published_at = v_published_at,
         summary = COALESCE(NULLIF(p_summary, ''), 'Revision ' || v_new_revision::text)
   WHERE id = 'active';

  RETURN jsonb_build_object(
    'success', true,
    'newRevision', v_new_revision,
    'publishedAt', v_published_at,
    'publishedBy', v_author
  );
END;
$$;

REVOKE ALL ON FUNCTION public.publish_studio_configuration(INTEGER, INTEGER, JSONB, JSONB, JSONB, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.publish_studio_configuration(INTEGER, INTEGER, JSONB, JSONB, JSONB, TEXT) TO authenticated;
