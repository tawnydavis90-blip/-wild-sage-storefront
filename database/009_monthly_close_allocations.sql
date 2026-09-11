-- Sage & Ember HQ: shared expense allocation + monthly close
CREATE TABLE IF NOT EXISTS expense_allocations (
  id bigserial PRIMARY KEY,
  expense_id uuid NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  allocation_percent numeric(7,4) NOT NULL CHECK(allocation_percent>=0 AND allocation_percent<=100),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(expense_id,business_id)
);
CREATE INDEX IF NOT EXISTS idx_expense_allocations_expense ON expense_allocations(expense_id);

CREATE TABLE IF NOT EXISTS monthly_closes (
  id bigserial PRIMARY KEY,
  month_key text NOT NULL UNIQUE CHECK(month_key ~ '^\d{4}-\d{2}$'),
  status text NOT NULL DEFAULT 'open',
  checklist jsonb NOT NULL DEFAULT '{}'::jsonb,
  notes text,
  locked_at timestamptz,
  locked_by text,
  snapshot jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
