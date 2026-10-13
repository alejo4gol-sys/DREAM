-- Control de términos de caducidad y prescripción para abogados.
CREATE TABLE legal_terms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  job_id uuid REFERENCES jobs(id) ON DELETE SET NULL,
  customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,
  rule_key varchar(40) NOT NULL,
  title varchar(200) NOT NULL,
  event_date varchar(10) NOT NULL,
  input jsonb NOT NULL,
  result jsonb NOT NULL,
  due_date varchar(10),
  status varchar(12) NOT NULL DEFAULT 'ACTIVE',
  checklist jsonb NOT NULL DEFAULT '[]'::jsonb,
  notes text,
  alerts_sent jsonb NOT NULL DEFAULT '[]'::jsonb,
  closed_at timestamptz,
  created_by_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX legal_terms_business_due_idx ON legal_terms (business_id, due_date);
CREATE INDEX legal_terms_job_idx ON legal_terms (job_id);
