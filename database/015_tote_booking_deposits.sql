ALTER TABLE tote_rentals ADD COLUMN IF NOT EXISTS booking_deposit_plan boolean NOT NULL DEFAULT false;
ALTER TABLE tote_rentals ADD COLUMN IF NOT EXISTS deposit_paid boolean NOT NULL DEFAULT false;
ALTER TABLE tote_rentals ADD COLUMN IF NOT EXISTS hold_until timestamptz;
ALTER TABLE tote_rentals ADD COLUMN IF NOT EXISTS manage_token text;
ALTER TABLE tote_rentals ADD COLUMN IF NOT EXISTS damage_fee_cents integer NOT NULL DEFAULT 0;
ALTER TABLE tote_rentals ADD COLUMN IF NOT EXISTS collected_cents integer NOT NULL DEFAULT 0;
CREATE UNIQUE INDEX IF NOT EXISTS tote_rental_manage_token ON tote_rentals(manage_token) WHERE manage_token IS NOT NULL;
CREATE TABLE IF NOT EXISTS tote_booking_payments(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),booking_id uuid NOT NULL REFERENCES tote_rentals(id),kind text NOT NULL CHECK(kind IN ('deposit','balance')),session_id text UNIQUE NOT NULL,url text,amount_cents integer NOT NULL,paid boolean NOT NULL DEFAULT false,payment_intent text UNIQUE,refund_id text,refund_status text,refunded_cents integer NOT NULL DEFAULT 0);
