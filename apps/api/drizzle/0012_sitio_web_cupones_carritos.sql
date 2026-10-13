-- Sitio web a medida: entrega/recogida, cupones, carritos abandonados (con consentimiento),
-- promociones con autorización expresa, campañas con inversión y cierre del ciclo pedido → venta.
ALTER TABLE store_orders
  ADD COLUMN delivery_method varchar(20) NOT NULL DEFAULT 'DELIVERY',
  ADD COLUMN coupon_code varchar(40),
  ADD COLUMN discount numeric(14,2) NOT NULL DEFAULT '0',
  ADD COLUMN notes varchar(500),
  ADD COLUMN marketing_opt_in boolean NOT NULL DEFAULT false,
  ADD COLUMN sale_id uuid REFERENCES sales(id) ON DELETE SET NULL;

ALTER TABLE customers
  ADD COLUMN marketing_opt_in boolean NOT NULL DEFAULT false,
  ADD COLUMN marketing_opt_in_at timestamptz,
  ADD COLUMN marketing_opt_out_at timestamptz;

CREATE TABLE store_coupons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  code varchar(40) NOT NULL,
  description varchar(160),
  kind varchar(10) NOT NULL DEFAULT 'PERCENT',
  value numeric(14,2) NOT NULL,
  min_subtotal numeric(14,2) NOT NULL DEFAULT '0',
  max_uses integer,
  used_count integer NOT NULL DEFAULT 0,
  campaign varchar(160),
  starts_at timestamptz,
  expires_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (business_id, code)
);

CREATE TABLE store_carts (
  id uuid PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  customer_name varchar(160) NOT NULL,
  customer_phone varchar(40) NOT NULL,
  items jsonb NOT NULL,
  subtotal numeric(14,2) NOT NULL,
  consent_at timestamptz NOT NULL,
  reminded_at timestamptz,
  dismissed_at timestamptz,
  converted_order_id uuid REFERENCES store_orders(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX store_carts_business_updated_idx ON store_carts (business_id, updated_at);

CREATE TABLE marketing_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name varchar(160) NOT NULL,
  source varchar(80) NOT NULL,
  campaign_key varchar(160) NOT NULL,
  spend numeric(14,2) NOT NULL DEFAULT '0',
  coupon_code varchar(40),
  starts_on varchar(10),
  ends_on varchar(10),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (business_id, campaign_key)
);
