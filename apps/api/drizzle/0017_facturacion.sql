-- Facturación: datos tributarios y plantilla por negocio, numeraciones DIAN, facturas inmutables y archivos de la DIAN.
ALTER TABLE businesses ADD COLUMN invoice_settings jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE TABLE invoice_resolutions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  kind varchar(20) NOT NULL,
  resolution_number varchar(40) NOT NULL,
  resolution_date varchar(10) NOT NULL,
  prefix varchar(4),
  from_number integer NOT NULL,
  to_number integer NOT NULL,
  next_number integer NOT NULL,
  valid_from varchar(10),
  valid_to varchar(10),
  technical_key_enc text,
  environment varchar(1) NOT NULL DEFAULT '1',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX invoice_resolutions_business_kind_idx ON invoice_resolutions (business_id, kind);

CREATE TABLE invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  sale_id uuid REFERENCES sales(id) ON DELETE SET NULL,
  customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,
  kind varchar(12) NOT NULL DEFAULT 'INVOICE',
  doc_type varchar(20) NOT NULL,
  resolution_id uuid REFERENCES invoice_resolutions(id) ON DELETE SET NULL,
  prefix varchar(10),
  number integer NOT NULL,
  full_number varchar(30) NOT NULL,
  issued_at timestamptz NOT NULL DEFAULT now(),
  due_date timestamptz,
  payment_form varchar(10) NOT NULL,
  payment_means varchar(20),
  seller jsonb NOT NULL,
  buyer jsonb NOT NULL,
  items jsonb NOT NULL,
  taxes jsonb NOT NULL DEFAULT '[]'::jsonb,
  subtotal numeric(14,2) NOT NULL,
  discount_total numeric(14,2) NOT NULL,
  tax_total numeric(14,2) NOT NULL,
  total numeric(14,2) NOT NULL,
  amount_paid numeric(14,2) NOT NULL DEFAULT 0,
  notes text,
  warranty_months integer NOT NULL DEFAULT 0,
  warranty_until timestamptz,
  warranty_text text,
  template jsonb NOT NULL DEFAULT '{}'::jsonb,
  resolution_text text,
  status varchar(12) NOT NULL DEFAULT 'ISSUED',
  voided_at timestamptz,
  void_reason text,
  related_invoice_id uuid,
  dian_status varchar(20) NOT NULL DEFAULT 'NOT_APPLICABLE',
  cufe varchar(100),
  dian_environment varchar(1),
  dian_validated_at timestamptz,
  dian_message text,
  dian_provider varchar(40),
  integrity_hash varchar(64) NOT NULL,
  created_by_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX invoices_business_full_number_idx ON invoices (business_id, full_number);
CREATE INDEX invoices_business_issued_idx ON invoices (business_id, issued_at);
CREATE INDEX invoices_sale_idx ON invoices (sale_id);
CREATE INDEX invoices_customer_idx ON invoices (customer_id);

CREATE TABLE invoice_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  kind varchar(10) NOT NULL,
  filename varchar(160) NOT NULL,
  mime varchar(80) NOT NULL,
  size integer NOT NULL,
  content bytea NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX invoice_files_invoice_idx ON invoice_files (invoice_id);
