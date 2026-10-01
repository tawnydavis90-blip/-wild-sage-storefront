-- Apply the selected draft business name without overwriting a later custom name.
UPDATE tote_rental_settings SET brand='Wild Roots Tote Rentals',updated_at=now()
WHERE id=1 AND brand IN ('Sage & Ember Tote Rentals','Sage and Ember Tote Rentals');
UPDATE businesses SET display_name='Wild Roots Tote Rentals',updated_at=now()
WHERE slug='tote-rentals' AND display_name IN ('Sage & Ember Tote Rentals','Sage and Ember Tote Rentals');
UPDATE sites SET name='Wild Roots Tote Rentals',updated_at=now()
WHERE slug='tote-rentals' AND name IN ('Tote Rentals','Sage & Ember Tote Rentals');
