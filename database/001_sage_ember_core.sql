-- Sage & Ember Holdings central data platform
-- Migration 001: shared core schema
-- Safe to review; this file is not executed automatically.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS businesses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  legal_name text,
  display_name text NOT NULL,
  business_type text,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  slug text UNIQUE NOT NULL,
  name text NOT NULL,
  domain text,
  platform text,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS app_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  display_name text,
  password_hash text,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS business_user_roles (
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  role text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (business_id, user_id, role)
);

CREATE TABLE IF NOT EXISTS customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  external_customer_id text,
  email text,
  first_name text,
  last_name text,
  phone text,
  marketing_opt_in boolean NOT NULL DEFAULT false,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (business_id, external_customer_id)
);
CREATE INDEX IF NOT EXISTS idx_customers_business_email ON customers(business_id, email);

CREATE TABLE IF NOT EXISTS products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  external_product_id text,
  sku text,
  name text NOT NULL,
  description text,
  product_type text,
  active boolean NOT NULL DEFAULT true,
  cost numeric(12,2),
  price numeric(12,2),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (business_id, external_product_id)
);
CREATE INDEX IF NOT EXISTS idx_products_business_sku ON products(business_id, sku);

CREATE TABLE IF NOT EXISTS orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  site_id uuid REFERENCES sites(id) ON DELETE SET NULL,
  customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,
  external_order_id text,
  friendly_order_number text,
  status text NOT NULL DEFAULT 'pending',
  currency char(3) NOT NULL DEFAULT 'USD',
  subtotal numeric(12,2) NOT NULL DEFAULT 0,
  shipping numeric(12,2) NOT NULL DEFAULT 0,
  tax numeric(12,2) NOT NULL DEFAULT 0,
  discount numeric(12,2) NOT NULL DEFAULT 0,
  total numeric(12,2) NOT NULL DEFAULT 0,
  fulfillment_provider text,
  fulfillment_status text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  ordered_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (business_id, external_order_id)
);
CREATE INDEX IF NOT EXISTS idx_orders_business_date ON orders(business_id, ordered_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_id);

CREATE TABLE IF NOT EXISTS order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id uuid REFERENCES products(id) ON DELETE SET NULL,
  external_product_id text,
  external_variant_id text,
  sku text,
  name text NOT NULL,
  variant_name text,
  quantity integer NOT NULL CHECK (quantity > 0),
  unit_price numeric(12,2) NOT NULL DEFAULT 0,
  unit_cost numeric(12,2),
  line_total numeric(12,2) NOT NULL DEFAULT 0,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);

CREATE TABLE IF NOT EXISTS payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  order_id uuid REFERENCES orders(id) ON DELETE SET NULL,
  provider text NOT NULL,
  external_payment_id text,
  status text NOT NULL,
  amount numeric(12,2) NOT NULL DEFAULT 0,
  fee numeric(12,2),
  net_amount numeric(12,2),
  currency char(3) NOT NULL DEFAULT 'USD',
  paid_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, external_payment_id)
);
CREATE INDEX IF NOT EXISTS idx_payments_business_date ON payments(business_id, paid_at DESC);

CREATE TABLE IF NOT EXISTS expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  vendor text,
  category text,
  description text,
  amount numeric(12,2) NOT NULL,
  currency char(3) NOT NULL DEFAULT 'USD',
  expense_date date NOT NULL DEFAULT CURRENT_DATE,
  recurring boolean NOT NULL DEFAULT false,
  deductible boolean,
  receipt_url text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_expenses_business_date ON expenses(business_id, expense_date DESC);

CREATE TABLE IF NOT EXISTS inventory_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name text NOT NULL,
  location_type text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS inventory_levels (
  location_id uuid NOT NULL REFERENCES inventory_locations(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  quantity_on_hand integer NOT NULL DEFAULT 0,
  quantity_reserved integer NOT NULL DEFAULT 0,
  reorder_point integer,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (location_id, product_id)
);

CREATE TABLE IF NOT EXISTS analytics_events (
  id bigserial PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  site_id uuid REFERENCES sites(id) ON DELETE SET NULL,
  session_id text,
  visitor_id text,
  event_name text NOT NULL,
  path text,
  referrer text,
  properties jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_analytics_business_event_date ON analytics_events(business_id, event_name, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_visitor_date ON analytics_events(visitor_id, occurred_at DESC);

CREATE TABLE IF NOT EXISTS form_definitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid REFERENCES businesses(id) ON DELETE CASCADE,
  site_id uuid REFERENCES sites(id) ON DELETE CASCADE,
  slug text NOT NULL,
  name text NOT NULL,
  version integer NOT NULL DEFAULT 1,
  definition jsonb NOT NULL DEFAULT '{}'::jsonb,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (site_id, slug, version)
);

CREATE TABLE IF NOT EXISTS form_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id uuid NOT NULL REFERENCES form_definitions(id) ON DELETE CASCADE,
  session_id text,
  status text NOT NULL DEFAULT 'started',
  score numeric(8,2),
  answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  started_at timestamptz NOT NULL DEFAULT now(),
  submitted_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_form_submissions_form_status ON form_submissions(form_id, status, started_at DESC);

CREATE TABLE IF NOT EXISTS integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  provider text NOT NULL,
  account_label text,
  external_account_id text,
  status text NOT NULL DEFAULT 'active',
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_sync_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (business_id, provider, external_account_id)
);

CREATE TABLE IF NOT EXISTS sync_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id uuid NOT NULL REFERENCES integrations(id) ON DELETE CASCADE,
  sync_type text NOT NULL,
  status text NOT NULL DEFAULT 'running',
  records_read integer NOT NULL DEFAULT 0,
  records_written integer NOT NULL DEFAULT 0,
  error_message text,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);

CREATE TABLE IF NOT EXISTS audit_log (
  id bigserial PRIMARY KEY,
  business_id uuid REFERENCES businesses(id) ON DELETE SET NULL,
  user_id uuid REFERENCES app_users(id) ON DELETE SET NULL,
  action text NOT NULL,
  entity_type text,
  entity_id text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_audit_log_business_date ON audit_log(business_id, created_at DESC);

-- Seed the businesses/sites we already know about. Safe to re-run.
INSERT INTO businesses (slug, legal_name, display_name, business_type)
VALUES
  ('sage-ember-holdings', 'Sage and Ember Holdings LLC', 'Sage & Ember Holdings', 'holding_company'),
  ('wild-sage-apparel', NULL, 'Wild Sage Apparel', 'apparel'),
  ('sin-and-sage', NULL, 'Sin & Sage', 'ecommerce'),
  ('sole-rebel', NULL, 'Sole Rebel', 'ecommerce')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO sites (business_id, slug, name, platform)
SELECT id, 'wild-sage-storefront', 'Wild Sage Storefront', 'custom-render'
FROM businesses WHERE slug='wild-sage-apparel'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO sites (business_id, slug, name, platform)
SELECT id, 'sole-rebel-polls', 'Sole Rebel Polls', 'custom'
FROM businesses WHERE slug='sole-rebel'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO sites (business_id, slug, name, platform)
SELECT id, 'boyfriend-application', 'Boyfriend Application', 'custom'
FROM businesses WHERE slug='sage-ember-holdings'
ON CONFLICT (slug) DO NOTHING;
