-- Restrict direct access to managed profile mutations.
-- Browser clients may read profiles subject to RLS, but must use the
-- authorization-checked SECURITY DEFINER RPCs for profile writes and deletion.
BEGIN;

REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON TABLE public.profiles
  FROM PUBLIC, anon, authenticated;

GRANT SELECT
  ON TABLE public.profiles
  TO authenticated;

COMMIT;
