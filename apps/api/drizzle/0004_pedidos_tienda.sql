CREATE TYPE store_order_status AS ENUM ('RECEIVED', 'CONFIRMED', 'SHIPPED', 'DELIVERED', 'CANCELLED');
ALTER TYPE movement_type ADD VALUE 'ORDER_RESERVE';
ALTER TYPE movement_type ADD VALUE 'ORDER_RELEASE';

CREATE TABLE store_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  status store_order_status NOT NULL DEFAULT 'RECEIVED',
  customer_name varchar(160) NOT NULL,
  customer_phone varchar(40) NOT NULL,
  address varchar(255) NOT NULL,
  city varchar(120) NOT NULL,
  payment_method varchar(80) NOT NULL,
  data_use_accepted_at timestamptz NOT NULL,
  total numeric(14,2) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  confirmed_at timestamptz,
  shipped_at timestamptz,
  delivered_at timestamptz,
  cancelled_at timestamptz
);
CREATE INDEX store_orders_business_created_idx ON store_orders (business_id, created_at);
CREATE INDEX store_orders_business_status_idx ON store_orders (business_id, status);

CREATE TABLE store_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES store_orders(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES products(id),
  product_name varchar(200) NOT NULL,
  quantity integer NOT NULL,
  unit_price numeric(14,2) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX store_order_items_order_idx ON store_order_items (order_id);
