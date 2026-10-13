ALTER TABLE payments
  ADD COLUMN target_plan_code plan_code REFERENCES plans(code),
  ADD COLUMN transaction_id varchar(120),
  ADD COLUMN payment_method varchar(40);

CREATE INDEX payments_provider_reference_idx ON payments (provider, provider_ref);
