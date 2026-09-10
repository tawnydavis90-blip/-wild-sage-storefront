-- Migration 007: move Sole Rebel registry to the Render-hosted service.
UPDATE sites
SET domain='https://sole-rebel-render.onrender.com',
    dashboard_url='https://sole-rebel-render.onrender.com/dashboard',
    platform='render-node',
    status='active',
    updated_at=NOW()
WHERE slug='sole-rebel-storefront';
