-- Migration 006: extend central expenses for subscriptions and recurring costs.
-- Safe to re-run.

ALTER TABLE expenses ADD COLUMN IF NOT EXISTS frequency text;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS next_due_date date;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS auto_renew boolean;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS payment_method_hint text;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS external_subscription_id text;

CREATE INDEX IF NOT EXISTS idx_expenses_recurring_due
ON expenses (business_id, next_due_date)
WHERE recurring = true AND active = true;
