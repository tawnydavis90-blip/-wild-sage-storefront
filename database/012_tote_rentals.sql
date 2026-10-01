-- Tote rental operations. Re-runnable, no sample orders or inventory.
INSERT INTO businesses(slug,legal_name,display_name,business_type,status)
VALUES('tote-rentals','Sage and Ember Holdings LLC','Sage & Ember Tote Rentals','rental','planned') ON CONFLICT(slug) DO NOTHING;
INSERT INTO sites(business_id,slug,name,domain,dashboard_url,platform,status)
SELECT id,'tote-rentals','Tote Rentals','https://sageandemberholdings.com/totes/','https://sageandemberholdings.com/totes/admin.html','render-shared','planned' FROM businesses WHERE slug='tote-rentals' ON CONFLICT(slug) DO NOTHING;
CREATE TABLE IF NOT EXISTS tote_rental_settings (
 id integer PRIMARY KEY CHECK(id=1), brand text NOT NULL DEFAULT 'Sage & Ember Tote Rentals',
 total_totes integer NOT NULL DEFAULT 0 CHECK(total_totes>=0), total_dollies integer NOT NULL DEFAULT 0 CHECK(total_dollies>=0),
 damaged_totes integer NOT NULL DEFAULT 0 CHECK(damaged_totes>=0), damaged_dollies integer NOT NULL DEFAULT 0 CHECK(damaged_dollies>=0),
 delivery_area text NOT NULL DEFAULT '', updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK(damaged_totes<=total_totes),CHECK(damaged_dollies<=total_dollies)
);
INSERT INTO tote_rental_settings(id) VALUES(1) ON CONFLICT DO NOTHING;
CREATE TABLE IF NOT EXISTS tote_rentals (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),reference text UNIQUE NOT NULL,
 name text NOT NULL,email text NOT NULL,phone text NOT NULL,
 delivery_address text NOT NULL DEFAULT '',pickup_address text NOT NULL DEFAULT '',delivery boolean NOT NULL,
 start_date date NOT NULL,end_date date NOT NULL CHECK(end_date>start_date),
 totes integer NOT NULL CHECK(totes>=10 AND totes<=500),dollies integer NOT NULL CHECK(dollies>=0 AND dollies<=10),weeks integer NOT NULL CHECK(weeks BETWEEN 1 AND 12),
 total_cents integer NOT NULL CHECK(total_cents>=0),status text NOT NULL DEFAULT 'requested' CHECK(status IN ('requested','confirmed','out','cleaning','completed','declined','cancelled')),
 payment_status text NOT NULL DEFAULT 'unpaid' CHECK(payment_status IN ('unpaid','paid','refunded')),
 returned_totes integer,returned_dollies integer,damaged_totes integer NOT NULL DEFAULT 0,damaged_dollies integer NOT NULL DEFAULT 0,
 customer_notes text NOT NULL DEFAULT '',staff_notes text NOT NULL DEFAULT '',
 created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS tote_rentals_status_dates ON tote_rentals(status,start_date,end_date);
