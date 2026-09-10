-- Preserve Wild Sage's existing table contract inside the Sage & Ember database.
-- Keep central analytics separate from Wild Sage's legacy analytics_events table.

DO $$
BEGIN
  IF to_regclass('public.core_analytics_events') IS NULL AND to_regclass('public.analytics_events') IS NOT NULL THEN
    ALTER TABLE analytics_events RENAME TO core_analytics_events;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS accounting_expenses (
  id bigserial PRIMARY KEY,
  expense_date date NOT NULL,
  category text NOT NULL,
  vendor text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  amount_cents integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS accounting_settings (
  setting_key text PRIMARY KEY,
  setting_value jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS admin_media (
  id text PRIMARY KEY,
  filename text NOT NULL,
  mime_type text NOT NULL,
  media_bytes bytea NOT NULL,
  size_bytes integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS analytics_events (
  id bigserial PRIMARY KEY,
  event_type text NOT NULL,
  product_id text,
  session_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS collection_settings (
  collection_id text PRIMARY KEY,
  label text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS product_collection_assignments (
  product_id text PRIMARY KEY,
  collection_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS product_merchandising (
  product_id text PRIMARY KEY,
  featured boolean NOT NULL DEFAULT false,
  best_seller boolean NOT NULL DEFAULT false,
  mockup_urls jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  current_drop boolean NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS store_settings (
  setting_key text PRIMARY KEY,
  setting_value jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS data_migration_log (
  migration_key text PRIMARY KEY,
  completed_at timestamptz NOT NULL DEFAULT now(),
  details jsonb NOT NULL DEFAULT '{}'::jsonb
);
