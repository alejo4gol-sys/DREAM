ALTER TABLE store_orders
  ADD COLUMN payment_status varchar(20) NOT NULL DEFAULT 'PENDING',
  ADD COLUMN payment_provider varchar(30),
  ADD COLUMN payment_transaction_id varchar(120),
  ADD COLUMN paid_at timestamptz;
ALTER TABLE businesses
  ADD COLUMN wompi_public_key varchar(120),
  ADD COLUMN wompi_private_key_enc text,
  ADD COLUMN wompi_integrity_secret_enc text,
  ADD COLUMN wompi_event_secret_enc text;
ALTER TABLE store_orders
  ADD COLUMN customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,
  ADD COLUMN customer_purchase_counted_at timestamptz;
CREATE UNIQUE INDEX store_orders_payment_transaction_uidx ON store_orders (payment_transaction_id) WHERE payment_transaction_id IS NOT NULL;
