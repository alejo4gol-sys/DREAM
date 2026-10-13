-- Devoluciones (desde la página web y desde ventas en el local) y base de conocimiento del asistente.
ALTER TYPE movement_type ADD VALUE IF NOT EXISTS 'RETURN';

CREATE TABLE returns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  number integer NOT NULL,
  source varchar(20) NOT NULL,
  store_order_id uuid REFERENCES store_orders(id) ON DELETE SET NULL,
  sale_id uuid REFERENCES sales(id) ON DELETE SET NULL,
  customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,
  customer_name varchar(160) NOT NULL,
  customer_phone varchar(40),
  reason varchar(30) NOT NULL,
  details varchar(1000),
  resolution varchar(20) NOT NULL DEFAULT 'REFUND',
  status varchar(20) NOT NULL DEFAULT 'REQUESTED',
  items jsonb NOT NULL,
  refund_amount numeric(14,2) NOT NULL DEFAULT '0',
  refund_method varchar(20),
  refund_reference varchar(120),
  restocked_cost numeric(14,2) NOT NULL DEFAULT '0',
  response_note varchar(1000),
  created_by_id uuid,
  requested_at timestamptz NOT NULL DEFAULT now(),
  approved_at timestamptz,
  received_at timestamptz,
  resolved_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (business_id, number)
);
CREATE INDEX returns_business_status_idx ON returns (business_id, status);
CREATE INDEX returns_business_resolved_idx ON returns (business_id, resolved_at);
CREATE INDEX returns_store_order_idx ON returns (store_order_id);
CREATE INDEX returns_sale_idx ON returns (sale_id);

CREATE TABLE knowledge_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  title varchar(160) NOT NULL,
  content text NOT NULL,
  category varchar(40) NOT NULL DEFAULT 'GENERAL',
  product_id uuid REFERENCES products(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX knowledge_entries_business_idx ON knowledge_entries (business_id);
