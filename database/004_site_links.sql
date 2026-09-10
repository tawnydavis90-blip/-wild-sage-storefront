-- Migration 004: add dashboard URLs alongside live site URLs.
-- Safe to re-run.

ALTER TABLE sites ADD COLUMN IF NOT EXISTS dashboard_url text;

UPDATE sites
SET domain='https://wild-sage-storefront.onrender.com',
    dashboard_url='https://wild-sage-storefront.onrender.com/admin'
WHERE slug='wild-sage-storefront';

UPDATE sites
SET domain='https://wild-sage-storefront.onrender.com/holding',
    dashboard_url='https://wild-sage-storefront.onrender.com/holding'
WHERE slug='sage-ember-hq';

UPDATE sites
SET domain='https://sole-rebel-polls.tawnydavis90.chatgpt.site',
    dashboard_url='https://sole-rebel-polls.tawnydavis90.chatgpt.site/dashboard'
WHERE slug='sole-rebel-polls';

UPDATE sites
SET domain='https://sole-rebel-orders.tawnydavis90.chatgpt.site',
    dashboard_url='https://sole-rebel-orders.tawnydavis90.chatgpt.site/dashboard',
    name='Sole Rebel Orders',
    platform='chatgpt-site-external',
    status='external'
WHERE slug='sole-rebel-storefront';

UPDATE sites
SET domain='https://tawnys-boyfriend-application.tawnydavis90.chatgpt.site',
    dashboard_url='https://tawnys-boyfriend-application.tawnydavis90.chatgpt.site/dashboard'
WHERE slug='boyfriend-application';

UPDATE sites
SET domain='https://sin-and-sage.tawnydavis90.chatgpt.site/',
    name='Sin & Sage Storefront',
    platform='chatgpt-site-external',
    status='external'
WHERE slug='sin-and-sage-storefront';

-- Dashboard URLs for any remaining external sites stay NULL until exact routes are confirmed.
