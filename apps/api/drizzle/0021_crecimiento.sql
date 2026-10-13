-- Crecimiento: guía de arranque, referidos, testimonios, links de cobro, paquetes y membresías,
-- listas de precios mayoristas, plantillas jurídicas, reseñas del directorio y proveedor de facturación electrónica.
ALTER TABLE businesses ADD COLUMN referral_code varchar(12) UNIQUE;
ALTER TABLE businesses ADD COLUMN referred_by_business_id uuid REFERENCES businesses(id) ON DELETE SET NULL;
ALTER TABLE businesses ADD COLUMN onboarding jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE businesses ADD COLUMN einvoice_provider jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE invoices ADD COLUMN dian_data jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE TABLE referral_rewards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  referred_business_id uuid NOT NULL UNIQUE REFERENCES businesses(id) ON DELETE CASCADE,
  payment_id uuid,
  plan_code varchar(20),
  days integer NOT NULL DEFAULT 15,
  granted_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX referral_rewards_referrer ON referral_rewards (referrer_business_id);

CREATE TABLE testimonials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  user_id uuid,
  author_name varchar(120) NOT NULL,
  business_name varchar(160) NOT NULL,
  city varchar(120),
  rating integer NOT NULL,
  body text NOT NULL,
  consent boolean NOT NULL DEFAULT false,
  status varchar(12) NOT NULL DEFAULT 'PENDING',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX testimonials_status ON testimonials (status, created_at);

CREATE TABLE payment_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  sale_id uuid REFERENCES sales(id) ON DELETE SET NULL,
  job_id uuid REFERENCES jobs(id) ON DELETE SET NULL,
  provider varchar(12) NOT NULL DEFAULT 'WOMPI',
  provider_id varchar(80) NOT NULL,
  url text NOT NULL,
  amount numeric(14,2) NOT NULL,
  description varchar(200) NOT NULL,
  status varchar(12) NOT NULL DEFAULT 'ACTIVE',
  transaction_id varchar(80),
  paid_at timestamptz,
  created_by_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX payment_links_provider ON payment_links (provider, provider_id);
CREATE INDEX payment_links_sale ON payment_links (sale_id);

CREATE TABLE service_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  product_id uuid REFERENCES products(id) ON DELETE SET NULL,
  name varchar(160) NOT NULL,
  kind varchar(12) NOT NULL,
  description text,
  sessions integer,
  validity_days integer NOT NULL DEFAULT 30,
  price numeric(14,2) NOT NULL,
  service_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX service_packages_business ON service_packages (business_id);

CREATE TABLE customer_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  package_id uuid REFERENCES service_packages(id) ON DELETE SET NULL,
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  sale_id uuid REFERENCES sales(id) ON DELETE SET NULL,
  name varchar(160) NOT NULL,
  kind varchar(12) NOT NULL,
  sessions_total integer,
  sessions_used integer NOT NULL DEFAULT 0,
  starts_at varchar(10) NOT NULL,
  ends_at varchar(10) NOT NULL,
  price numeric(14,2) NOT NULL,
  status varchar(12) NOT NULL DEFAULT 'ACTIVE',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX customer_packages_business ON customer_packages (business_id, status);
CREATE INDEX customer_packages_customer ON customer_packages (customer_id);

CREATE TABLE package_usages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_package_id uuid NOT NULL REFERENCES customer_packages(id) ON DELETE CASCADE,
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  used_at timestamptz NOT NULL DEFAULT now(),
  note varchar(300),
  created_by_id uuid
);
CREATE INDEX package_usages_pkg ON package_usages (customer_package_id);

CREATE TABLE price_lists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name varchar(120) NOT NULL,
  description varchar(300),
  discount_percent numeric(5,2) NOT NULL DEFAULT 0,
  min_order_total numeric(14,2) NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX price_lists_business ON price_lists (business_id);
CREATE TABLE price_list_items (
  price_list_id uuid NOT NULL REFERENCES price_lists(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  price numeric(14,2) NOT NULL,
  min_qty integer NOT NULL DEFAULT 1,
  PRIMARY KEY (price_list_id, product_id)
);
ALTER TABLE customers ADD COLUMN price_list_id uuid REFERENCES price_lists(id) ON DELETE SET NULL;
ALTER TABLE customers ADD COLUMN credit_limit numeric(14,2);
ALTER TABLE customers ADD COLUMN payment_terms_days integer;

CREATE TABLE legal_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid REFERENCES businesses(id) ON DELETE CASCADE,
  code varchar(60),
  area varchar(40) NOT NULL,
  category varchar(80) NOT NULL,
  title varchar(200) NOT NULL,
  description text,
  body text NOT NULL,
  fields jsonb NOT NULL DEFAULT '[]'::jsonb,
  keywords jsonb NOT NULL DEFAULT '[]'::jsonb,
  legal_basis text,
  source varchar(12) NOT NULL DEFAULT 'CUSTOM',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX legal_templates_business ON legal_templates (business_id, area);
CREATE UNIQUE INDEX legal_templates_code ON legal_templates (coalesce(business_id, '00000000-0000-0000-0000-000000000000'::uuid), code) WHERE code IS NOT NULL;

CREATE TABLE legal_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  job_id uuid REFERENCES jobs(id) ON DELETE SET NULL,
  template_id uuid REFERENCES legal_templates(id) ON DELETE SET NULL,
  title varchar(200) NOT NULL,
  body text NOT NULL,
  created_by_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX legal_documents_job ON legal_documents (business_id, job_id);

CREATE TABLE business_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  author_name varchar(80) NOT NULL,
  rating integer NOT NULL,
  body text,
  status varchar(12) NOT NULL DEFAULT 'PUBLISHED',
  reply text,
  replied_at timestamptz,
  report_reason varchar(300),
  fingerprint varchar(64) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX business_reviews_business ON business_reviews (business_id, status, created_at);
