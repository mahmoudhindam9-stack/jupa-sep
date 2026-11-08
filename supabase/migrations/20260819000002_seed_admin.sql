-- Enable pgcrypto for the crypt() function
CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
DECLARE
  v_existing_id uuid;
BEGIN
  -- Ensure any existing admin profile retains the admin role without setting or overwriting a hardcoded password
  SELECT id INTO v_existing_id FROM auth.users WHERE email = 'admin@restocash.com' LIMIT 1;
  IF v_existing_id IS NOT NULL THEN
    UPDATE public.profiles
    SET role = 'admin', updated_at = now()
    WHERE id = v_existing_id;
  END IF;
END $$;
