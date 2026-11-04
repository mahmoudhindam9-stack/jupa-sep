-- ============================================================
-- Migration: Cashier Shift Opening & Access Workflow Enforcement
-- 1. Prevents cashier role accounts from closing or deleting shifts at DB level.
-- 2. Prevents duplicate active shifts for the same cashier in the same department (restaurant or park).
-- 3. Ensures shift ownership and permissions are validated server-side.
-- ============================================================

CREATE OR REPLACE FUNCTION public.validate_shift_audit_log_workflow()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_role TEXT;
  v_existing_open_shift_id TEXT;
BEGIN
  -- 1. Determine authenticated user's role if logged in via Supabase Auth
  IF auth.uid() IS NOT NULL THEN
    SELECT LOWER(COALESCE(role::text, ''))
    INTO v_user_role
    FROM public.profiles
    WHERE id = auth.uid()
    LIMIT 1;
  END IF;

  -- 2. Enforce Cashier Shift Permissions: Cashiers must NOT close or delete shifts
  IF v_user_role = 'cashier' AND NEW.action IN ('CLOSE', 'DELETE') THEN
    RAISE EXCEPTION 'Cashier accounts are not authorized to close or delete shifts. Only managers or administrators can close shifts.';
  END IF;

  -- 3. Prevent duplicate active shifts for the same cashier in the same department (restaurant or park)
  IF NEW.action = 'OPEN' AND NEW.cashier_id IS NOT NULL AND TRIM(NEW.cashier_id) <> '' THEN
    SELECT sal.shift_id
    INTO v_existing_open_shift_id
    FROM public.shift_audit_logs sal
    WHERE sal.shift_type = NEW.shift_type
      AND LOWER(TRIM(sal.cashier_id)) = LOWER(TRIM(NEW.cashier_id))
      AND sal.action IN ('OPEN', 'AUTO_CREATE')
      AND sal.shift_id <> NEW.shift_id
      AND NOT EXISTS (
        SELECT 1
        FROM public.shift_audit_logs closed_log
        WHERE closed_log.shift_id = sal.shift_id
          AND closed_log.shift_type = sal.shift_type
          AND closed_log.action IN ('CLOSE', 'DELETE')
      )
    LIMIT 1;

    IF v_existing_open_shift_id IS NOT NULL THEN
      RAISE EXCEPTION 'Cashier already has an active open shift (%) in the % department.', v_existing_open_shift_id, NEW.shift_type;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_shift_audit_log_workflow ON public.shift_audit_logs;

CREATE TRIGGER trg_validate_shift_audit_log_workflow
BEFORE INSERT ON public.shift_audit_logs
FOR EACH ROW
EXECUTE FUNCTION public.validate_shift_audit_log_workflow();

CREATE INDEX IF NOT EXISTS idx_shift_audit_logs_cashier_type_action
  ON public.shift_audit_logs(shift_type, cashier_id, action);
