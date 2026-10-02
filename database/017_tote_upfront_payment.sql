-- Existing reservations retain the payment agreement accepted at booking.
ALTER TABLE tote_rentals ADD COLUMN IF NOT EXISTS pay_upfront boolean NOT NULL DEFAULT false;
