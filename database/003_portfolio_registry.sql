-- Migration 003: Register the remaining Sage & Ember portfolio
-- Safe to re-run.

-- Ensure all known businesses exist.
INSERT INTO businesses (slug, legal_name, display_name, business_type, status)
VALUES
  ('sage-ember-holdings', 'Sage and Ember Holdings LLC', 'Sage & Ember Holdings', 'holding_company', 'active'),
  ('wild-sage-apparel', NULL, 'Wild Sage Apparel', 'apparel', 'active'),
  ('sin-and-sage', NULL, 'Sin & Sage', 'ecommerce', 'planned'),
  ('sole-rebel', NULL, 'Sole Rebel', 'ecommerce', 'active')
ON CONFLICT (slug) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  business_type = EXCLUDED.business_type;

-- Parent-company HQ record. No public domain has been confirmed yet.
INSERT INTO sites (business_id, slug, name, domain, platform, status)
SELECT id, 'sage-ember-hq', 'Sage & Ember Business HQ', NULL, 'render-shared', 'active'
FROM businesses WHERE slug='sage-ember-holdings'
ON CONFLICT (slug) DO UPDATE SET
  name=EXCLUDED.name, platform=EXCLUDED.platform, status=EXCLUDED.status;

-- Wild Sage storefront is already connected to the shared database.
INSERT INTO sites (business_id, slug, name, domain, platform, status)
SELECT id, 'wild-sage-storefront', 'Wild Sage Storefront', 'https://wild-sage-storefront.onrender.com', 'render', 'active'
FROM businesses WHERE slug='wild-sage-apparel'
ON CONFLICT (slug) DO UPDATE SET
  domain=EXCLUDED.domain, platform=EXCLUDED.platform, status=EXCLUDED.status;

-- Sole Rebel Polls is an external ChatGPT-hosted site. It is registered in HQ now;
-- its internal data remains on chatgpt.site until a database/export bridge is available.
INSERT INTO sites (business_id, slug, name, domain, platform, status)
SELECT id, 'sole-rebel-polls', 'Sole Rebel Polls', 'https://sole-rebel-polls.tawnydavis90.chatgpt.site', 'chatgpt-site-external', 'external'
FROM businesses WHERE slug='sole-rebel'
ON CONFLICT (slug) DO UPDATE SET
  domain=EXCLUDED.domain, platform=EXCLUDED.platform, status=EXCLUDED.status;

-- Sole Rebel selling site record. Exact live URL has not been confirmed.
INSERT INTO sites (business_id, slug, name, domain, platform, status)
SELECT id, 'sole-rebel-storefront', 'Sole Rebel Storefront', NULL, 'external-or-planned', 'needs_connection'
FROM businesses WHERE slug='sole-rebel'
ON CONFLICT (slug) DO UPDATE SET
  name=EXCLUDED.name, platform=EXCLUDED.platform;

-- Sin & Sage business/storefront record. Exact live URL has not been confirmed.
INSERT INTO sites (business_id, slug, name, domain, platform, status)
SELECT id, 'sin-and-sage-storefront', 'Sin & Sage Storefront', NULL, 'external-or-planned', 'needs_connection'
FROM businesses WHERE slug='sin-and-sage'
ON CONFLICT (slug) DO UPDATE SET
  name=EXCLUDED.name, platform=EXCLUDED.platform;

-- Boyfriend Application belongs directly under the holding-company portfolio.
INSERT INTO sites (business_id, slug, name, domain, platform, status)
SELECT id, 'boyfriend-application', 'Boyfriend Application', 'https://tawnys-boyfriend-application.tawnydavis90.chatgpt.site', 'chatgpt-site-external', 'external'
FROM businesses WHERE slug='sage-ember-holdings'
ON CONFLICT (slug) DO UPDATE SET
  domain=EXCLUDED.domain, platform=EXCLUDED.platform, status=EXCLUDED.status;

-- Register the boyfriend application as a known form product in the central schema.
INSERT INTO form_definitions (business_id, site_id, slug, name, version, definition, active)
SELECT b.id, s.id, 'boyfriend-application', 'Boyfriend Application', 1,
       jsonb_build_object('source','external-chatgpt-site','connection_status','registered','data_sync','not_available_yet'),
       true
FROM businesses b
JOIN sites s ON s.business_id=b.id AND s.slug='boyfriend-application'
WHERE b.slug='sage-ember-holdings'
ON CONFLICT (site_id, slug, version) DO UPDATE SET active=true;
