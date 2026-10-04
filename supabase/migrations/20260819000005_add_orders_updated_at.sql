ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

UPDATE public.orders
SET updated_at = COALESCE(updated_at, created_at, now())
WHERE updated_at IS NULL;