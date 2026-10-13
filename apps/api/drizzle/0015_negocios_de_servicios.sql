-- Negocios de servicios (abogados, técnicos, salones, consultores…): agenda, casos/órdenes de servicio y catálogo de servicios.
ALTER TABLE businesses
  ADD COLUMN business_model varchar(20) NOT NULL DEFAULT 'PRODUCTS',
  ADD COLUMN service_profile varchar(30);

ALTER TABLE products
  ADD COLUMN is_service boolean NOT NULL DEFAULT false,
  ADD COLUMN pricing_unit varchar(20) NOT NULL DEFAULT 'FIXED';

CREATE TABLE jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  number integer NOT NULL,
  tracking_code varchar(12) NOT NULL,
  customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,
  title varchar(200) NOT NULL,
  category varchar(80),
  status varchar(20) NOT NULL DEFAULT 'OPEN',
  priority varchar(10) NOT NULL DEFAULT 'NORMAL',
  assigned_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  description text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  due_at timestamptz,
  quote_status varchar(12) NOT NULL DEFAULT 'NONE',
  quote_sent_at timestamptz,
  quote_decided_at timestamptz,
  warranty_days integer NOT NULL DEFAULT 0,
  sale_id uuid REFERENCES sales(id) ON DELETE SET NULL,
  created_by_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz,
  UNIQUE (business_id, number),
  UNIQUE (business_id, tracking_code)
);
CREATE INDEX jobs_business_status_idx ON jobs (business_id, status);
CREATE INDEX jobs_business_due_idx ON jobs (business_id, due_at);
CREATE INDEX jobs_customer_idx ON jobs (customer_id);

CREATE TABLE job_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  product_id uuid REFERENCES products(id) ON DELETE SET NULL,
  kind varchar(12) NOT NULL DEFAULT 'SERVICE',
  description varchar(200) NOT NULL,
  quantity numeric(10,2) NOT NULL DEFAULT '1',
  unit_price numeric(14,2) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX job_items_job_idx ON job_items (job_id);

CREATE TABLE job_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  type varchar(12) NOT NULL,
  body text NOT NULL,
  minutes integer,
  billable boolean NOT NULL DEFAULT false,
  visible_to_customer boolean NOT NULL DEFAULT false,
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX job_events_job_idx ON job_events (job_id, occurred_at);

CREATE TABLE appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,
  customer_name varchar(160),
  customer_phone varchar(40),
  product_id uuid REFERENCES products(id) ON DELETE SET NULL,
  job_id uuid REFERENCES jobs(id) ON DELETE SET NULL,
  store_order_id uuid REFERENCES store_orders(id) ON DELETE SET NULL,
  assigned_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  title varchar(200) NOT NULL,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  status varchar(12) NOT NULL DEFAULT 'SCHEDULED',
  modality varchar(12) NOT NULL DEFAULT 'IN_PERSON',
  location varchar(255),
  notes varchar(1000),
  source varchar(10) NOT NULL DEFAULT 'PANEL',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at > starts_at)
);
CREATE INDEX appointments_business_starts_idx ON appointments (business_id, starts_at);
