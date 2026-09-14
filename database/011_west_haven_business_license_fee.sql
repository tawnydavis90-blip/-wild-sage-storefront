-- Migration 011: record West Haven City business license fee.
-- One-time Sage & Ember Holdings compliance expense. Safe to re-run.

WITH parent AS (
  SELECT id FROM businesses WHERE slug = 'sage-ember-holdings'
)
INSERT INTO expenses (
  business_id, vendor, category, description, amount, currency,
  expense_date, recurring, deductible, active, external_subscription_id, metadata
)
SELECT parent.id,
       'West Haven City',
       'Licenses & Permits',
       'West Haven City business license fee',
       51.75,
       'USD',
       DATE '2026-09-14',
       false,
       true,
       true,
       'west-haven-business-license-2026',
       '{"source":"user_confirmed","license_status":"preapproved","expense_type":"business_license"}'::jsonb
FROM parent
WHERE NOT EXISTS (
  SELECT 1 FROM expenses e
  WHERE e.external_subscription_id = 'west-haven-business-license-2026'
);