-- Migration 010: add Sole Rebel paid Render web-service subscription.
-- Safe to re-run.

WITH sole_rebel AS (
  SELECT id FROM businesses WHERE slug = 'sole-rebel'
)
INSERT INTO expenses (
  business_id, vendor, category, description, amount, currency,
  expense_date, recurring, frequency, active, auto_renew,
  external_subscription_id, metadata
)
SELECT sole_rebel.id,
       'Render',
       'Software & Infrastructure',
       'Sole Rebel paid web service (0.5c-512mb)',
       7.00,
       'USD',
       CURRENT_DATE,
       true,
       'monthly',
       true,
       true,
       'render-sole-rebel-0.5c-512mb',
       '{"source":"verified_render_config","amount_status":"verified","service":"sole-rebel-render","plan":"0.5c-512mb"}'::jsonb
FROM sole_rebel
WHERE NOT EXISTS (
  SELECT 1
  FROM expenses e
  WHERE e.external_subscription_id = 'render-sole-rebel-0.5c-512mb'
);
