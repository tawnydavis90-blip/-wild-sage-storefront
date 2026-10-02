ALTER TABLE tote_rentals ADD COLUMN IF NOT EXISTS cancellation_policy text NOT NULL DEFAULT 'refundable-deposit-v1';
ALTER TABLE tote_rentals ADD COLUMN IF NOT EXISTS rental_start_at timestamptz;
ALTER TABLE tote_rentals ADD COLUMN IF NOT EXISTS cancelled_at timestamptz;
ALTER TABLE tote_rentals ADD COLUMN IF NOT EXISTS cancellation_actor text;
ALTER TABLE tote_rentals ADD COLUMN IF NOT EXISTS cancellation_reason text NOT NULL DEFAULT '';
ALTER TABLE tote_rentals ADD COLUMN IF NOT EXISTS cancellation_fee_cents integer NOT NULL DEFAULT 0;
ALTER TABLE tote_booking_payments ADD COLUMN IF NOT EXISTS refund_amount_cents integer;
