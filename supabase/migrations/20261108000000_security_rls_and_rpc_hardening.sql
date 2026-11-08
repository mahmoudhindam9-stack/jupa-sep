-- =============================================================================
-- Security Hardening Migration: RLS Policies, Permissions & SECURITY DEFINER RPCs
-- Ensures no unauthorized public (anon) write access on sensitive ERP tables
-- and enforces least-privilege execution on SECURITY DEFINER functions.
-- =============================================================================
BEGIN;

-- 1. Ensure erp_store_state exists and RLS is enabled on sensitive state, permissions, and audit tables
CREATE TABLE IF NOT EXISTS public.erp_store_state (
  id text PRIMARY KEY,
  state jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid NULL
);

ALTER TABLE IF EXISTS public.erp_store_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.user_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.shift_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.profiles ENABLE ROW LEVEL SECURITY;

-- 2. Configure clean RLS policies for erp_store_state and restrict sensitive audit-log access by user role
DO $$
BEGIN
  -- erp_store_state: authenticated users can read and upsert ERP state cleanly
  IF to_regclass('public.erp_store_state') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Allow all for anon and authenticated" ON public.erp_store_state;
    DROP POLICY IF EXISTS "Public full access to erp_store_state" ON public.erp_store_state;
    DROP POLICY IF EXISTS "erp_store_state_anon_select" ON public.erp_store_state;
    DROP POLICY IF EXISTS "erp_store_state_anon_write" ON public.erp_store_state;
    DROP POLICY IF EXISTS "erp_store_state_select_policy" ON public.erp_store_state;
    DROP POLICY IF EXISTS "erp_store_state_insert_policy" ON public.erp_store_state;
    DROP POLICY IF EXISTS "erp_store_state_update_policy" ON public.erp_store_state;
    DROP POLICY IF EXISTS "erp_store_state_authenticated_access" ON public.erp_store_state;
    DROP POLICY IF EXISTS "erp_store_state_authenticated_select" ON public.erp_store_state;
    DROP POLICY IF EXISTS "erp_store_state_authenticated_insert" ON public.erp_store_state;
    DROP POLICY IF EXISTS "erp_store_state_authenticated_update" ON public.erp_store_state;

    REVOKE ALL ON TABLE public.erp_store_state FROM anon;
    GRANT SELECT, INSERT, UPDATE ON TABLE public.erp_store_state TO authenticated;

    CREATE POLICY "erp_store_state_authenticated_select"
      ON public.erp_store_state
      FOR SELECT
      TO authenticated
      USING (auth.uid() IS NOT NULL);

    CREATE POLICY "erp_store_state_authenticated_insert"
      ON public.erp_store_state
      FOR INSERT
      TO authenticated
      WITH CHECK (auth.uid() IS NOT NULL);

    CREATE POLICY "erp_store_state_authenticated_update"
      ON public.erp_store_state
      FOR UPDATE
      TO authenticated
      USING (auth.uid() IS NOT NULL)
      WITH CHECK (auth.uid() IS NOT NULL);
  END IF;

  -- user_permissions: only authenticated users may read; only user managers may write
  IF to_regclass('public.user_permissions') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Allow all access to user_permissions" ON public.user_permissions;
    DROP POLICY IF EXISTS "Public access to user_permissions" ON public.user_permissions;
    DROP POLICY IF EXISTS "user_permissions_authenticated_read" ON public.user_permissions;
    DROP POLICY IF EXISTS "user_permissions_admin_write" ON public.user_permissions;

    REVOKE ALL ON TABLE public.user_permissions FROM anon;
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.user_permissions TO authenticated;

    CREATE POLICY "user_permissions_authenticated_read"
      ON public.user_permissions
      FOR SELECT
      TO authenticated
      USING (auth.uid() IS NOT NULL);

    CREATE POLICY "user_permissions_admin_write"
      ON public.user_permissions
      FOR ALL
      TO authenticated
      USING (public.current_user_can_manage_profiles())
      WITH CHECK (public.current_user_can_manage_profiles());
  END IF;

  -- audit_logs: authenticated users may insert; reading sensitive audit logs is restricted by role
  IF to_regclass('public.audit_logs') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Public insert audit_logs" ON public.audit_logs;
    DROP POLICY IF EXISTS "Allow all audit_logs" ON public.audit_logs;
    DROP POLICY IF EXISTS "audit_logs_authenticated_read" ON public.audit_logs;
    DROP POLICY IF EXISTS "audit_logs_role_based_read" ON public.audit_logs;
    DROP POLICY IF EXISTS "audit_logs_authenticated_insert" ON public.audit_logs;

    REVOKE ALL ON TABLE public.audit_logs FROM anon;
    GRANT SELECT, INSERT ON TABLE public.audit_logs TO authenticated;

    CREATE POLICY "audit_logs_role_based_read"
      ON public.audit_logs
      FOR SELECT
      TO authenticated
      USING (
        public.current_user_can_manage_profiles()
        OR EXISTS (
          SELECT 1
          FROM public.profiles p
          WHERE p.id = auth.uid()
            AND p.role IN ('admin', 'super_admin', 'manager', 'accountant')
        )
      );

    CREATE POLICY "audit_logs_authenticated_insert"
      ON public.audit_logs
      FOR INSERT
      TO authenticated
      WITH CHECK (auth.uid() IS NOT NULL);
  END IF;

  -- shift_audit_logs: authenticated users may insert; reading sensitive shift audit logs is restricted by role
  IF to_regclass('public.shift_audit_logs') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Allow public read shift_audit_logs" ON public.shift_audit_logs;
    DROP POLICY IF EXISTS "Allow public insert shift_audit_logs" ON public.shift_audit_logs;
    DROP POLICY IF EXISTS "shift_audit_logs_authenticated_read" ON public.shift_audit_logs;
    DROP POLICY IF EXISTS "shift_audit_logs_role_based_read" ON public.shift_audit_logs;
    DROP POLICY IF EXISTS "shift_audit_logs_authenticated_insert" ON public.shift_audit_logs;

    REVOKE ALL ON TABLE public.shift_audit_logs FROM anon;
    GRANT SELECT, INSERT ON TABLE public.shift_audit_logs TO authenticated;

    CREATE POLICY "shift_audit_logs_role_based_read"
      ON public.shift_audit_logs
      FOR SELECT
      TO authenticated
      USING (
        public.current_user_can_manage_profiles()
        OR EXISTS (
          SELECT 1
          FROM public.profiles p
          WHERE p.id = auth.uid()
            AND p.role IN ('admin', 'super_admin', 'manager', 'accountant')
        )
      );

    CREATE POLICY "shift_audit_logs_authenticated_insert"
      ON public.shift_audit_logs
      FOR INSERT
      TO authenticated
      WITH CHECK (auth.uid() IS NOT NULL);
  END IF;
END $$;

-- 3. Lock down administrative SECURITY DEFINER RPCs from anonymous execution
DO $$
BEGIN
  IF to_regprocedure('public.create_managed_user_account(text,text,text,text,text,text,jsonb)') IS NOT NULL THEN
    REVOKE ALL ON FUNCTION public.create_managed_user_account(text,text,text,text,text,text,jsonb) FROM PUBLIC, anon;
    GRANT EXECUTE ON FUNCTION public.create_managed_user_account(text,text,text,text,text,text,jsonb) TO authenticated;
  END IF;

  IF to_regprocedure('public.update_managed_user_password(uuid,text)') IS NOT NULL THEN
    REVOKE ALL ON FUNCTION public.update_managed_user_password(uuid,text) FROM PUBLIC, anon;
    GRANT EXECUTE ON FUNCTION public.update_managed_user_password(uuid,text) TO authenticated;
  END IF;

  IF to_regprocedure('public.upsert_managed_user_profile(uuid,text,text,text,text,jsonb)') IS NOT NULL THEN
    REVOKE ALL ON FUNCTION public.upsert_managed_user_profile(uuid,text,text,text,text,jsonb) FROM PUBLIC, anon;
    GRANT EXECUTE ON FUNCTION public.upsert_managed_user_profile(uuid,text,text,text,text,jsonb) TO authenticated;
  END IF;

  IF to_regprocedure('public.delete_managed_user_profile(uuid)') IS NOT NULL THEN
    REVOKE ALL ON FUNCTION public.delete_managed_user_profile(uuid) FROM PUBLIC, anon;
    GRANT EXECUTE ON FUNCTION public.delete_managed_user_profile(uuid) TO authenticated;
  END IF;
END $$;

COMMIT;
