-- Enable QR self-ordering statuses, table location metadata, and realtime notifications for Captain.
BEGIN;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS pricing_currency text DEFAULT 'EGP',
  ADD COLUMN IF NOT EXISTS payment_currency text DEFAULT 'EGP',
  ADD COLUMN IF NOT EXISTS payment_exchange_rate numeric DEFAULT 1,
  ADD COLUMN IF NOT EXISTS payment_amount numeric,
  ADD COLUMN IF NOT EXISTS customer_tracking_token text;

CREATE UNIQUE INDEX IF NOT EXISTS orders_customer_tracking_token_idx
  ON public.orders(customer_tracking_token)
  WHERE customer_tracking_token IS NOT NULL;

-- Expand allowed order statuses so QR self-orders (pending_captain, sent_to_cashier, completed) work natively
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE public.orders
  ADD CONSTRAINT orders_status_check
  CHECK (
    status IN (
      'pending',
      'pending_captain',
      'STATUS_PENDING_CAPTAIN',
      'sent_to_cashier',
      'preparing',
      'ready',
      'served',
      'completed',
      'cancelled'
    )
  );

-- Ensure anon and authenticated can create and track self-orders
GRANT SELECT, INSERT ON public.orders TO anon, authenticated;
GRANT UPDATE ON public.orders TO authenticated;
GRANT USAGE ON SEQUENCE public.orders_order_number_seq TO anon, authenticated;

DROP POLICY IF EXISTS "public create orders" ON public.orders;
CREATE POLICY "public create orders"
  ON public.orders
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "public read orders" ON public.orders;
CREATE POLICY "public read orders"
  ON public.orders
  FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "authenticated update orders" ON public.orders;
CREATE POLICY "authenticated update orders"
  ON public.orders
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Ensure orders table is in supabase_realtime publication for live Captain & Customer notifications
DO $orders_realtime$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime'
  ) AND NOT EXISTS (
    SELECT 1
      FROM pg_publication_tables
     WHERE pubname = 'supabase_realtime'
       AND schemaname = 'public'
       AND tablename = 'orders'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.orders';
  END IF;
END;
$orders_realtime$;

COMMIT;
