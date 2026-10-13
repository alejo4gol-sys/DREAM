ALTER TABLE store_orders
  ADD COLUMN shipping_fee numeric(14,2) NOT NULL DEFAULT '0',
  ADD COLUMN attribution_source varchar(80),
  ADD COLUMN attribution_medium varchar(80),
  ADD COLUMN attribution_campaign varchar(160),
  ADD COLUMN attribution_content varchar(160);

CREATE INDEX store_orders_attribution_idx
  ON store_orders (business_id, attribution_source, attribution_campaign);
