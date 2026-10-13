-- Seguimiento de procesos (Rama Judicial automático; demás entidades con recordatorio y registro manual)
-- y avisos por WhatsApp para abogados con plan activo.
CREATE TABLE process_watches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  job_id uuid REFERENCES jobs(id) ON DELETE SET NULL,
  source varchar(30) NOT NULL,
  kind varchar(30) NOT NULL DEFAULT 'OTRO',
  reference varchar(80) NOT NULL,
  extra jsonb NOT NULL DEFAULT '{}'::jsonb,
  title varchar(200) NOT NULL,
  mode varchar(10) NOT NULL,
  status varchar(10) NOT NULL DEFAULT 'ACTIVE',
  remind_days integer NOT NULL DEFAULT 7,
  summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_activity varchar(10),
  last_checked_at timestamptz,
  next_check_at timestamptz,
  last_change_at timestamptz,
  last_error text,
  error_count integer NOT NULL DEFAULT 0,
  unread integer NOT NULL DEFAULT 0,
  created_by_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX process_watches_business_source_ref ON process_watches (business_id, source, reference);
CREATE INDEX process_watches_due ON process_watches (status, next_check_at);
CREATE INDEX process_watches_job ON process_watches (job_id);

CREATE TABLE process_updates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  watch_id uuid NOT NULL REFERENCES process_watches(id) ON DELETE CASCADE,
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  external_id varchar(60) NOT NULL,
  date varchar(10),
  title varchar(300) NOT NULL,
  body text,
  term_start varchar(10),
  term_end varchar(10),
  origin varchar(10) NOT NULL DEFAULT 'AUTO',
  has_docs boolean NOT NULL DEFAULT false,
  baseline boolean NOT NULL DEFAULT false,
  created_by_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX process_updates_watch_ext ON process_updates (watch_id, external_id);
CREATE INDEX process_updates_business_created ON process_updates (business_id, created_at);

CREATE TABLE whatsapp_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  phone varchar(20) NOT NULL,
  alerts jsonb NOT NULL DEFAULT '[]'::jsonb,
  consent_text text NOT NULL,
  consent_version varchar(10) NOT NULL,
  consented_at timestamptz NOT NULL,
  consent_ip varchar(64),
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX whatsapp_contacts_user_business ON whatsapp_contacts (user_id, business_id);
CREATE INDEX whatsapp_contacts_phone ON whatsapp_contacts (phone);

CREATE TABLE outbound_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  user_id uuid,
  channel varchar(12) NOT NULL DEFAULT 'WHATSAPP',
  to_phone varchar(20) NOT NULL,
  template varchar(80) NOT NULL,
  params jsonb NOT NULL DEFAULT '{}'::jsonb,
  status varchar(20) NOT NULL,
  provider_id varchar(160),
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX outbound_messages_business_created ON outbound_messages (business_id, created_at);
CREATE INDEX outbound_messages_provider ON outbound_messages (provider_id);
