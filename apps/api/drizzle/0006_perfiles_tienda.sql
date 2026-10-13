ALTER TABLE products ADD COLUMN store_options jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE products ADD COLUMN preparation_minutes integer;
ALTER TABLE products ADD COLUMN deposit_percent integer NOT NULL DEFAULT 0;
ALTER TABLE store_orders ADD COLUMN payment_due numeric(14,2);
UPDATE store_orders SET payment_due = total;
ALTER TABLE store_orders ALTER COLUMN payment_due SET NOT NULL;
ALTER TABLE store_order_items ADD COLUMN selected_options jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE store_order_items ADD COLUMN preparation_minutes integer;
ALTER TABLE store_order_items ADD COLUMN deposit_percent integer NOT NULL DEFAULT 0;
