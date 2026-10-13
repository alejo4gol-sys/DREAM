-- Calculadora de honorarios: ajustes por negocio y propuestas guardadas.
ALTER TABLE businesses ADD COLUMN fee_settings jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE TABLE fee_quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  number integer NOT NULL,
  customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,
  title varchar(200) NOT NULL,
  table_key varchar(30) NOT NULL,
  area varchar(40),
  description text,
  input jsonb NOT NULL,
  result jsonb NOT NULL,
  total numeric(14,2) NOT NULL,
  job_id uuid REFERENCES jobs(id) ON DELETE SET NULL,
  created_by_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (business_id, number)
);
CREATE INDEX fee_quotes_business_created_idx ON fee_quotes (business_id, created_at);
