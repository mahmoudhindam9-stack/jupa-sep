-- Developer Studio Pro — Complete Persistence, Concurrency & Atomic Publish Repair
-- Audits and repairs:
--   1. can_manage_developer_studio()
--   2. developer_studio_access_status()
--   3. developer_studio_check_draft_sync(text, text)
--   4. developer_studio_save_draft(text, text, text, integer, integer, jsonb, jsonb, jsonb)
--   5. publish_studio_configuration(integer, integer, jsonb, jsonb, jsonb, text)
-- Preserves strict least-privilege RLS policies and authenticated EXECUTE grants.

BEGIN;

GRANT USAGE ON SCHEMA public TO anon, authenticated;

ALTER TABLE public.studio_published_configs
  ADD COLUMN IF NOT EXISTS dom_edits JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.studio_drafts
  ADD COLUMN IF NOT EXISTS dom_edits JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE UNIQUE INDEX IF NOT EXISTS studio_drafts_owner_uidx
  ON public.studio_drafts (owner);

CREATE INDEX IF NOT EXISTS idx_studio_history_revision
  ON public.studio_history (revision DESC);

-- Ensure active published configuration row always exists
INSERT INTO public.studio_published_configs (
  id, revision, schema_version, pages, elements, dom_edits, published_by, summary
)
VALUES (
  'active',
  1,
  1,
  '{"page_dashboard":{"id":"page_dashboard","route":"/admin","name":"لوحة الأقسام الرئيسية","elementIds":[],"styles":{"paddingTop":"16px","paddingBottom":"16px"},"schemaVersion":1,"revision":1,"updatedAt":"2026-10-14T00:00:00.000Z","updatedBy":"system"}}'::jsonb,
  '{}'::jsonb,
  '{}'::jsonb,
  'system',
  'التهيئة التلقائية لنظام Developer Studio Pro'
)
ON CONFLICT (id) DO NOTHING;

-- 1. Permission helper (column-safe via to_jsonb)
CREATE OR REPLACE FUNCTION public.can_manage_developer_studio()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $canmanage$
  SELECT auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1
      FROM public.profiles AS p
     WHERE p.id = auth.uid()
       AND (
         lower(COALESCE(to_jsonb(p)->>'role', '')) IN ('admin', 'super_admin', 'owner', 'manager')
         OR lower(COALESCE(to_jsonb(p)->>'developer_options', 'false')) = 'true'
         OR COALESCE(to_jsonb(p)->'permissions', '{}'::jsonb)
              @> '{"developer_options": true}'::jsonb
         OR COALESCE(to_jsonb(p)->'permissions', '{}'::jsonb)
              @> '{"super_admin_full_access": true}'::jsonb
       )
  );
$canmanage$;

REVOKE ALL ON FUNCTION public.can_manage_developer_studio() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_manage_developer_studio() TO authenticated;

-- 2. Diagnostic RPC for current session
CREATE OR REPLACE FUNCTION public.developer_studio_access_status()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $accessstatus$
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

  SELECT to_jsonb(p) INTO v_profile
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
  v_allowed := v_role IN ('admin', 'super_admin', 'owner', 'manager') OR v_developer_options;

  RETURN jsonb_build_object(
    'authenticated', true,
    'user_id', v_user_id,
    'profile_found', true,
    'role', v_role,
    'developer_options', v_developer_options,
    'allowed', v_allowed,
    'reason', CASE WHEN v_allowed THEN 'authorized' ELSE 'missing_developer_studio_permission' END
  );
END;
$accessstatus$;

REVOKE ALL ON FUNCTION public.developer_studio_access_status() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.developer_studio_access_status() TO authenticated;

-- 3. Draft sync compatibility check RPC
CREATE OR REPLACE FUNCTION public.developer_studio_check_draft_sync(
  p_owner TEXT,
  p_expected_updated_at TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $checkdraft$
DECLARE
  v_row public.studio_drafts%ROWTYPE;
  v_expected TIMESTAMPTZ := NULL;
  v_has_expected BOOLEAN := false;
  v_draft JSONB;
BEGIN
  IF NOT public.can_manage_developer_studio() THEN
    RETURN jsonb_build_object(
      'compatible', false,
      'error', 'NOT_AUTHORIZED: سجّل الدخول بحساب إداري يملك صلاحية استوديو المطور.'
    );
  END IF;

  IF NULLIF(p_expected_updated_at, '') IS NOT NULL
     AND p_expected_updated_at <> '__unknown_server_version__' THEN
    BEGIN
      v_expected := p_expected_updated_at::timestamptz;
      v_has_expected := true;
    EXCEPTION WHEN others THEN
      RETURN jsonb_build_object(
        'compatible', false,
        'error', 'صيغة إصدار المسودة المحلية غير صالحة؛ أعد تحميل آخر نسخة محفوظة ثم حاول مجددًا.'
      );
    END;
  END IF;

  SELECT *
    INTO v_row
    FROM public.studio_drafts
   WHERE owner = p_owner
   ORDER BY updated_at DESC NULLS LAST
   LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'compatible', true,
      'exists', false,
      'needsRebase', false,
      'serverUpdatedAt', NULL
    );
  END IF;

  v_draft := jsonb_build_object(
    'id', v_row.id,
    'owner', v_row.owner,
    'baseRevision', v_row.base_revision,
    'schemaVersion', v_row.schema_version,
    'pages', v_row.pages,
    'elements', v_row.elements,
    'domEdits', COALESCE(v_row.dom_edits, '{}'::jsonb),
    'updatedAt', v_row.updated_at,
    'serverUpdatedAt', v_row.updated_at,
    'createdAt', v_row.created_at
  );

  IF NOT v_has_expected THEN
    RETURN jsonb_build_object(
      'compatible', true,
      'exists', true,
      'needsRebase', true,
      'serverUpdatedAt', v_row.updated_at,
      'serverDraft', v_draft,
      'message', 'تم العثور على مسودة سحابية محفوظة؛ أُعيد دمجها مع التعديلات المحلية قبل المزامنة.'
    );
  END IF;

  IF v_row.updated_at <> v_expected THEN
    RETURN jsonb_build_object(
      'compatible', false,
      'exists', true,
      'needsRebase', false,
      'serverUpdatedAt', v_row.updated_at,
      'serverDraft', v_draft,
      'error', 'تغيرت المسودة على الخادم من جلسة أخرى. احتفظنا بنسختك المحلية ولم نستبدل التغييرات البعيدة.'
    );
  END IF;

  RETURN jsonb_build_object(
    'compatible', true,
    'exists', true,
    'needsRebase', false,
    'serverUpdatedAt', v_row.updated_at
  );
END;
$checkdraft$;

REVOKE ALL ON FUNCTION public.developer_studio_check_draft_sync(TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.developer_studio_check_draft_sync(TEXT, TEXT) TO authenticated;

-- 4. Atomic permission-checked draft save RPC
CREATE OR REPLACE FUNCTION public.developer_studio_save_draft(
  p_owner TEXT,
  p_draft_id TEXT,
  p_expected_updated_at TEXT,
  p_base_revision INTEGER,
  p_schema_version INTEGER,
  p_pages JSONB,
  p_elements JSONB,
  p_dom_edits JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $savedraft$
DECLARE
  v_existing public.studio_drafts%ROWTYPE;
  v_saved public.studio_drafts%ROWTYPE;
  v_expected TIMESTAMPTZ := NULL;
  v_has_expected BOOLEAN := false;
  v_now TIMESTAMPTZ := clock_timestamp();
BEGIN
  IF NOT public.can_manage_developer_studio() THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'NOT_AUTHORIZED: سجّل الدخول بحساب إداري يملك صلاحية استوديو المطور.'
    );
  END IF;

  IF NULLIF(p_owner, '') IS NULL OR p_pages IS NULL OR p_elements IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'بيانات المسودة غير مكتملة.');
  END IF;

  IF NULLIF(p_expected_updated_at, '') IS NOT NULL
     AND p_expected_updated_at <> '__unknown_server_version__' THEN
    BEGIN
      v_expected := p_expected_updated_at::timestamptz;
      v_has_expected := true;
    EXCEPTION WHEN others THEN
      RETURN jsonb_build_object('success', false, 'error', 'إصدار المسودة المحلية غير صالح؛ لم تتم المزامنة.');
    END;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('studio-draft:' || p_owner, 0));

  SELECT *
    INTO v_existing
    FROM public.studio_drafts
   WHERE owner = p_owner
   ORDER BY updated_at DESC NULLS LAST
   LIMIT 1
   FOR UPDATE;

  IF FOUND THEN
    IF v_has_expected AND v_existing.updated_at <> v_expected THEN
      RETURN jsonb_build_object(
        'success', false,
        'conflict', true,
        'serverUpdatedAt', v_existing.updated_at,
        'error', 'تغيرت المسودة السحابية من جلسة أخرى. تم الاحتفاظ بتعديلاتك المحلية؛ أعد فحص التوافق قبل المزامنة.'
      );
    END IF;

    UPDATE public.studio_drafts
       SET base_revision = COALESCE(p_base_revision, base_revision),
           schema_version = COALESCE(p_schema_version, schema_version),
           pages = p_pages,
           elements = p_elements,
           dom_edits = COALESCE(p_dom_edits, '{}'::jsonb),
           updated_at = v_now
     WHERE id = v_existing.id
     RETURNING * INTO v_saved;
  ELSE
    INSERT INTO public.studio_drafts (
      id, owner, base_revision, schema_version, pages, elements, dom_edits, created_at, updated_at
    ) VALUES (
      COALESCE(NULLIF(p_draft_id, ''), 'draft_' || p_owner),
      p_owner,
      COALESCE(p_base_revision, 1),
      COALESCE(p_schema_version, 1),
      p_pages,
      p_elements,
      COALESCE(p_dom_edits, '{}'::jsonb),
      v_now,
      v_now
    )
    RETURNING * INTO v_saved;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'id', v_saved.id,
    'owner', v_saved.owner,
    'updatedAt', v_saved.updated_at,
    'serverUpdatedAt', v_saved.updated_at
  );
END;
$savedraft$;

REVOKE ALL ON FUNCTION public.developer_studio_save_draft(TEXT, TEXT, TEXT, INTEGER, INTEGER, JSONB, JSONB, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.developer_studio_save_draft(TEXT, TEXT, TEXT, INTEGER, INTEGER, JSONB, JSONB, JSONB) TO authenticated;

-- 5. Atomic server-confirmed publish RPC (column-safe profile lookup + history snapshot + draft baseline alignment)
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
AS $publishconfig$
DECLARE
  v_current public.studio_published_configs%ROWTYPE;
  v_profile JSONB;
  v_new_revision INTEGER;
  v_author TEXT;
  v_published_at TIMESTAMPTZ := clock_timestamp();
BEGIN
  IF NOT public.can_manage_developer_studio() THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'NOT_AUTHORIZED: نشر التعديلات يتطلب حساب مدير مصرح له.'
    );
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('studio-publish:active', 0));

  SELECT *
    INTO v_current
    FROM public.studio_published_configs
   WHERE id = 'active'
   FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.studio_published_configs (
      id, revision, schema_version, pages, elements, dom_edits, published_by, published_at, summary
    ) VALUES (
      'active', 1, COALESCE(p_schema_version, 1), '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, 'system', v_published_at, 'Initial seed'
    )
    RETURNING * INTO v_current;
  END IF;

  IF v_current.revision <> p_expected_revision THEN
    RETURN jsonb_build_object(
      'success', false,
      'conflict', true,
      'currentRevision', v_current.revision,
      'error', 'CONCURRENCY_CONFLICT: تم نشر إصدار أحدث على الخادم (رقم ' || v_current.revision::text || ').'
    );
  END IF;

  v_new_revision := v_current.revision + 1;

  SELECT to_jsonb(p)
    INTO v_profile
    FROM public.profiles AS p
   WHERE p.id = auth.uid()
   LIMIT 1;

  v_author := COALESCE(
    NULLIF(v_profile->>'username', ''),
    NULLIF(v_profile->>'full_name', ''),
    NULLIF(v_profile->>'name', ''),
    NULLIF(v_profile->>'email', ''),
    auth.uid()::text,
    'admin'
  );

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
         schema_version = COALESCE(p_schema_version, 1),
         pages = COALESCE(p_pages, '{}'::jsonb),
         elements = COALESCE(p_elements, '{}'::jsonb),
         dom_edits = COALESCE(p_dom_edits, '{}'::jsonb),
         published_by = v_author,
         published_at = v_published_at,
         summary = COALESCE(NULLIF(p_summary, ''), 'الإصدار #' || v_new_revision::text)
   WHERE id = 'active';

  -- Align any existing admin draft baseline with the newly published revision
  UPDATE public.studio_drafts
     SET base_revision = v_new_revision,
         pages = COALESCE(p_pages, pages),
         elements = COALESCE(p_elements, elements),
         dom_edits = COALESCE(p_dom_edits, dom_edits),
         updated_at = v_published_at
   WHERE owner = 'admin';

  RETURN jsonb_build_object(
    'success', true,
    'newRevision', v_new_revision,
    'publishedAt', v_published_at,
    'publishedBy', v_author
  );
END;
$publishconfig$;

REVOKE ALL ON FUNCTION public.publish_studio_configuration(INTEGER, INTEGER, JSONB, JSONB, JSONB, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.publish_studio_configuration(INTEGER, INTEGER, JSONB, JSONB, JSONB, TEXT) TO authenticated;

-- Re-verify RLS policies and table grants
ALTER TABLE public.studio_published_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.studio_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.studio_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS studio_published_public_read ON public.studio_published_configs;
CREATE POLICY studio_published_public_read
  ON public.studio_published_configs
  FOR SELECT TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS studio_drafts_admin_access ON public.studio_drafts;
CREATE POLICY studio_drafts_admin_access
  ON public.studio_drafts
  FOR ALL TO authenticated
  USING (public.can_manage_developer_studio())
  WITH CHECK (public.can_manage_developer_studio());

DROP POLICY IF EXISTS studio_history_admin_read ON public.studio_history;
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

COMMIT;
