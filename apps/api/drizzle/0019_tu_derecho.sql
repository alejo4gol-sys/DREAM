-- Micro app «Tu Derecho»: perfiles de abogados, consultas de personas y propuestas.
CREATE TABLE lawyer_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL UNIQUE REFERENCES businesses(id) ON DELETE CASCADE,
  user_id uuid,
  display_name varchar(160) NOT NULL,
  professional_card varchar(30) NOT NULL,
  verification varchar(12) NOT NULL DEFAULT 'PENDING',
  verification_note text,
  topics jsonb NOT NULL DEFAULT '[]'::jsonb,
  departments jsonb NOT NULL DEFAULT '[]'::jsonb,
  remote boolean NOT NULL DEFAULT false,
  years_experience integer NOT NULL DEFAULT 0,
  bio text,
  accepting boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE help_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code varchar(10) NOT NULL UNIQUE,
  token_hash varchar(64) NOT NULL,
  topic varchar(30) NOT NULL,
  answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  description text NOT NULL,
  public_description text NOT NULL,
  department varchar(60) NOT NULL,
  city varchar(120),
  urgent boolean NOT NULL DEFAULT false,
  orientation jsonb NOT NULL,
  contact_name varchar(160) NOT NULL,
  contact_phone varchar(40) NOT NULL,
  contact_email varchar(255),
  consent_text text NOT NULL,
  consent_at timestamptz NOT NULL,
  status varchar(12) NOT NULL DEFAULT 'OPEN',
  deadline_at timestamptz NOT NULL,
  chosen_proposal_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX help_requests_status_topic_idx ON help_requests (status, topic);
CREATE INDEX help_requests_created_idx ON help_requests (created_at);

CREATE TABLE help_proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES help_requests(id) ON DELETE CASCADE,
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  user_id uuid,
  fee_amount numeric(14,2) NOT NULL,
  fee_terms text NOT NULL,
  plan text NOT NULL,
  estimated_time varchar(120) NOT NULL,
  experience text,
  status varchar(12) NOT NULL DEFAULT 'SENT',
  job_id uuid REFERENCES jobs(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX help_proposals_request_business_idx ON help_proposals (request_id, business_id);
CREATE INDEX help_proposals_business_idx ON help_proposals (business_id);
