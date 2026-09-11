-- Sage & Ember HQ operations layer
-- Migration 008: cross-business customers, order activity, business settings, and site bridges
-- Safe to re-run.

CREATE TABLE IF NOT EXISTS master_customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text,
  phone text,
  display_name text,
  shipping_address jsonb NOT NULL DEFAULT '{}'::jsonb,
  notes text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_master_customers_email ON master_customers(lower(email)) WHERE email IS NOT NULL AND email<>'';
CREATE UNIQUE INDEX IF NOT EXISTS uq_master_customers_phone ON master_customers(phone) WHERE phone IS NOT NULL AND phone<>'';

CREATE TABLE IF NOT EXISTS master_customer_businesses (
  master_customer_id uuid NOT NULL REFERENCES master_customers(id) ON DELETE CASCADE,
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  first_order_at timestamptz,
  last_order_at timestamptz,
  order_count integer NOT NULL DEFAULT 0,
  lifetime_spend numeric(12,2) NOT NULL DEFAULT 0,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(master_customer_id,business_id)
);

CREATE TABLE IF NOT EXISTS order_activity (
  id bigserial PRIMARY KEY,
  order_id uuid REFERENCES orders(id) ON DELETE CASCADE,
  business_id uuid REFERENCES businesses(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  status text,
  detail text,
  source text NOT NULL DEFAULT 'hq',
  event_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS idx_order_activity_order_time ON order_activity(order_id,event_at DESC);
CREATE INDEX IF NOT EXISTS idx_order_activity_business_time ON order_activity(business_id,event_at DESC);

CREATE TABLE IF NOT EXISTS business_settings (
  business_id uuid PRIMARY KEY REFERENCES businesses(id) ON DELETE CASCADE,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS site_bridges (
  site_id uuid PRIMARY KEY REFERENCES sites(id) ON DELETE CASCADE,
  bridge_type text NOT NULL DEFAULT 'api',
  status text NOT NULL DEFAULT 'not_connected',
  direction text NOT NULL DEFAULT 'inbound',
  last_sync_at timestamptz,
  last_error text,
  records_received bigint NOT NULL DEFAULT 0,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO business_settings(business_id,settings)
SELECT id,
  CASE WHEN slug='sole-rebel' THEN '{"pricing":{"pricePerDay":25,"flatShipping":6},"notifications":{"orderConfirmation":false,"paymentReminder":false,"shippingEmail":false,"shippingSms":false}}'::jsonb
       ELSE '{"notifications":{"orderConfirmation":false,"paymentReminder":false,"shippingEmail":false,"shippingSms":false}}'::jsonb END
FROM businesses
ON CONFLICT (business_id) DO NOTHING;

INSERT INTO site_bridges(site_id,bridge_type,status,direction,settings)
SELECT s.id,
  CASE WHEN s.slug IN ('wild-sage-storefront','sole-rebel-storefront') THEN 'direct_database' ELSE 'api' END,
  CASE WHEN s.slug IN ('wild-sage-storefront','sole-rebel-storefront') THEN 'connected' ELSE 'ready' END,
  'inbound',
  jsonb_build_object('siteSlug',s.slug)
FROM sites s
ON CONFLICT (site_id) DO NOTHING;
