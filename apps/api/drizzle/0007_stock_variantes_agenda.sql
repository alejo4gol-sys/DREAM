CREATE TABLE product_variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  sku varchar(80) NOT NULL,
  options jsonb NOT NULL,
  stock integer NOT NULL DEFAULT 0 CHECK (stock >= 0),
  min_stock integer NOT NULL DEFAULT 0 CHECK (min_stock >= 0),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (business_id, sku)
);
CREATE INDEX product_variants_product_idx ON product_variants (product_id);
ALTER TABLE products ADD COLUMN appointment_schedule jsonb;
ALTER TABLE store_order_items ADD COLUMN variant_id uuid REFERENCES product_variants(id) ON DELETE SET NULL;
