-- Online rental payments and refundable security deposits. Safe to rerun.
ALTER TABLE tote_rental_settings ADD COLUMN IF NOT EXISTS deposit_cents integer NOT NULL DEFAULT 0 CHECK(deposit_cents>=0 AND deposit_cents<=1000000);
ALTER TABLE tote_rental_settings ADD COLUMN IF NOT EXISTS deposit_terms text NOT NULL DEFAULT '';
ALTER TABLE tote_rentals ADD COLUMN IF NOT EXISTS deposit_cents integer NOT NULL DEFAULT 0;
ALTER TABLE tote_rentals ADD COLUMN IF NOT EXISTS tax_cents integer NOT NULL DEFAULT 0;
ALTER TABLE tote_rentals ADD COLUMN IF NOT EXISTS deposit_terms text NOT NULL DEFAULT '';
ALTER TABLE tote_rentals ADD COLUMN IF NOT EXISTS stripe_session_id text;
ALTER TABLE tote_rentals ADD COLUMN IF NOT EXISTS stripe_payment_intent text;
ALTER TABLE tote_rentals ADD COLUMN IF NOT EXISTS checkout_url text;
ALTER TABLE tote_rentals ADD COLUMN IF NOT EXISTS checkout_attempt integer NOT NULL DEFAULT 0;
ALTER TABLE tote_rentals ADD COLUMN IF NOT EXISTS deposit_refund_id text;
ALTER TABLE tote_rentals ADD COLUMN IF NOT EXISTS deposit_refund_status text;
ALTER TABLE tote_rentals ADD COLUMN IF NOT EXISTS payment_failed boolean NOT NULL DEFAULT false;
ALTER TABLE tote_rentals ADD COLUMN IF NOT EXISTS refunded_cents integer NOT NULL DEFAULT 0;
CREATE UNIQUE INDEX IF NOT EXISTS tote_rentals_stripe_session ON tote_rentals(stripe_session_id) WHERE stripe_session_id IS NOT NULL;
