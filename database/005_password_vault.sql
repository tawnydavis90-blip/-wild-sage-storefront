-- Migration 005: encrypted password vault for Sage & Ember HQ
-- Safe to re-run.

CREATE TABLE IF NOT EXISTS password_vault (
  id BIGSERIAL PRIMARY KEY,
  business_id UUID REFERENCES businesses(id) ON DELETE SET NULL,
  site_id UUID REFERENCES sites(id) ON DELETE SET NULL,
  label TEXT NOT NULL,
  website_url TEXT,
  username TEXT,
  encrypted_password TEXT NOT NULL,
  iv TEXT NOT NULL,
  auth_tag TEXT NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS password_vault_business_idx ON password_vault(business_id);
CREATE INDEX IF NOT EXISTS password_vault_site_idx ON password_vault(site_id);
CREATE INDEX IF NOT EXISTS password_vault_label_idx ON password_vault(label);
