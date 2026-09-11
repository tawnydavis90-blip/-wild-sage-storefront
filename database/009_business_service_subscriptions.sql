-- Migration 009: seed current business software/infrastructure subscriptions.
-- Safe to re-run. Unknown plan amounts are stored as 0 with metadata marking confirmation required.

WITH parent AS (
  SELECT id FROM businesses WHERE slug = 'sage-ember-holdings'
), wild_sage AS (
  SELECT id FROM businesses WHERE slug = 'wild-sage-apparel'
)
INSERT INTO expenses (
  business_id, vendor, category, description, amount, currency,
  expense_date, recurring, frequency, active, auto_renew,
  external_subscription_id, metadata
)
SELECT parent.id, v.vendor, 'Software & Infrastructure', v.description, v.amount, 'USD',
       CURRENT_DATE, true, 'monthly', true, true, v.external_id, v.metadata
FROM parent
CROSS JOIN (VALUES
  ('Render', 'Wild Sage / Sage & Ember paid web service (0.5c-512mb)', 7.00::numeric, 'render-web-0.5c-512mb', '{"source":"verified_render_config","amount_status":"verified"}'::jsonb),
  ('Render', 'Sage & Ember PostgreSQL database (basic_256mb)', 10.00::numeric, 'render-postgres-basic-256mb', '{"source":"verified_render_config","amount_status":"verified"}'::jsonb),
  ('GitHub', 'Source control and repository hosting', 0.00::numeric, 'github-account', '{"amount_status":"needs_plan_confirmation","note":"GitHub Free is $0; update if using a paid plan."}'::jsonb),
  ('ChatGPT', 'AI workspace used for business development and operations', 0.00::numeric, 'chatgpt-business-tool', '{"amount_status":"needs_plan_confirmation","note":"Enter the exact monthly ChatGPT plan charge."}'::jsonb)
) AS v(vendor, description, amount, external_id, metadata)
WHERE NOT EXISTS (
  SELECT 1 FROM expenses e WHERE e.external_subscription_id = v.external_id
);

WITH wild_sage AS (
  SELECT id FROM businesses WHERE slug = 'wild-sage-apparel'
)
INSERT INTO expenses (
  business_id, vendor, category, description, amount, currency,
  expense_date, recurring, frequency, active, auto_renew,
  external_subscription_id, metadata
)
SELECT wild_sage.id, v.vendor, 'Software & Infrastructure', v.description, v.amount, 'USD',
       CURRENT_DATE, true, 'monthly', true, true, v.external_id, v.metadata
FROM wild_sage
CROSS JOIN (VALUES
  ('Printify', 'Print-on-demand platform subscription', 0.00::numeric, 'printify-plan', '{"amount_status":"needs_plan_confirmation","note":"Free is $0/month; Premium is currently $39/month. Update to the active plan."}'::jsonb),
  ('Stripe', 'Payment processing account', 0.00::numeric, 'stripe-standard', '{"amount_status":"variable","note":"No standard monthly fee; processing fees are variable per successful transaction."}'::jsonb)
) AS v(vendor, description, amount, external_id, metadata)
WHERE NOT EXISTS (
  SELECT 1 FROM expenses e WHERE e.external_subscription_id = v.external_id
);
