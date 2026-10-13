ALTER TABLE businesses
  ADD COLUMN store_slug varchar(80),
  ADD COLUMN store_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN store_config jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE UNIQUE INDEX businesses_store_slug_unique ON businesses (store_slug);
