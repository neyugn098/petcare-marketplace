CREATE TABLE IF NOT EXISTS users (email TEXT PRIMARY KEY NOT NULL, full_name TEXT NOT NULL, created_at TEXT NOT NULL);

CREATE TABLE IF NOT EXISTS partners (id TEXT PRIMARY KEY NOT NULL, name TEXT NOT NULL, type TEXT NOT NULL CHECK(type IN ('vet','shop','both')), address TEXT NOT NULL, latitude REAL NOT NULL, longitude REAL NOT NULL, phone TEXT NOT NULL, rating REAL NOT NULL DEFAULT 0, review_count INTEGER NOT NULL DEFAULT 0, open_now INTEGER NOT NULL DEFAULT 0, accepting_appointments INTEGER NOT NULL DEFAULT 0, hours TEXT NOT NULL, services TEXT NOT NULL, distance_km REAL NOT NULL DEFAULT 0, verified INTEGER NOT NULL DEFAULT 0, updated_at TEXT NOT NULL);

CREATE TABLE IF NOT EXISTS partner_users (email TEXT NOT NULL, partner_id TEXT NOT NULL REFERENCES partners(id), role TEXT NOT NULL CHECK(role IN ('owner','manager','clinician','staff')), UNIQUE(email, partner_id));

CREATE TABLE IF NOT EXISTS pets (id TEXT PRIMARY KEY NOT NULL, owner_email TEXT NOT NULL, name TEXT NOT NULL, species TEXT NOT NULL, breed TEXT NOT NULL, sex TEXT NOT NULL, date_of_birth TEXT NOT NULL, weight_kg REAL NOT NULL, blood_type TEXT, microchip TEXT, allergies TEXT NOT NULL DEFAULT '', notes TEXT NOT NULL DEFAULT '', avatar TEXT NOT NULL DEFAULT '🐕', qr_token TEXT NOT NULL UNIQUE, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);

CREATE TABLE IF NOT EXISTS vaccinations (id TEXT PRIMARY KEY NOT NULL, pet_id TEXT NOT NULL REFERENCES pets(id), vaccine_name TEXT NOT NULL, dose TEXT NOT NULL, administered_at TEXT NOT NULL, next_due_at TEXT, provider_name TEXT NOT NULL, batch_number TEXT NOT NULL, status TEXT NOT NULL CHECK(status IN ('completed','due','overdue')), created_at TEXT NOT NULL);

CREATE TABLE IF NOT EXISTS appointments (id TEXT PRIMARY KEY NOT NULL, owner_email TEXT NOT NULL, pet_id TEXT NOT NULL REFERENCES pets(id), partner_id TEXT NOT NULL REFERENCES partners(id), scheduled_at TEXT NOT NULL, reason TEXT NOT NULL, note TEXT NOT NULL DEFAULT '', status TEXT NOT NULL CHECK(status IN ('pending','confirmed','completed','cancelled')), created_at TEXT NOT NULL, updated_at TEXT NOT NULL);

CREATE TABLE IF NOT EXISTS medical_records (id TEXT PRIMARY KEY NOT NULL, pet_id TEXT NOT NULL REFERENCES pets(id), partner_id TEXT NOT NULL REFERENCES partners(id), appointment_id TEXT REFERENCES appointments(id), diagnosis TEXT NOT NULL, treatment TEXT NOT NULL, prescription TEXT NOT NULL DEFAULT '', clinician TEXT NOT NULL, visited_at TEXT NOT NULL, notes TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL);

CREATE TABLE IF NOT EXISTS products (id TEXT PRIMARY KEY NOT NULL, partner_id TEXT NOT NULL REFERENCES partners(id), name TEXT NOT NULL, category TEXT NOT NULL, price INTEGER NOT NULL CHECK(price >= 0), original_price INTEGER, visual TEXT NOT NULL, visual_tone TEXT NOT NULL, rating REAL NOT NULL DEFAULT 0, sold INTEGER NOT NULL DEFAULT 0, stock INTEGER NOT NULL DEFAULT 0 CHECK(stock >= 0), badge TEXT, description TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1, updated_at TEXT NOT NULL);

CREATE TABLE IF NOT EXISTS audit_logs (id TEXT PRIMARY KEY NOT NULL, actor_email TEXT NOT NULL, action TEXT NOT NULL, entity_type TEXT NOT NULL, entity_id TEXT NOT NULL, created_at TEXT NOT NULL);

CREATE TABLE IF NOT EXISTS orders (id TEXT PRIMARY KEY NOT NULL, order_code TEXT NOT NULL UNIQUE, owner_email TEXT NOT NULL, partner_id TEXT NOT NULL REFERENCES partners(id), total_amount INTEGER NOT NULL CHECK(total_amount >= 0), status TEXT NOT NULL CHECK(status IN ('pending_payment','payment_review','paid','cancelled','fulfilled')), created_at TEXT NOT NULL, updated_at TEXT NOT NULL);

CREATE TABLE IF NOT EXISTS order_items (id TEXT PRIMARY KEY NOT NULL, order_id TEXT NOT NULL REFERENCES orders(id), product_id TEXT NOT NULL REFERENCES products(id), product_name TEXT NOT NULL, unit_price INTEGER NOT NULL CHECK(unit_price >= 0), quantity INTEGER NOT NULL CHECK(quantity > 0), line_total INTEGER NOT NULL CHECK(line_total >= 0));

CREATE INDEX IF NOT EXISTS pet_owner_idx ON pets(owner_email);

CREATE INDEX IF NOT EXISTS vaccination_pet_idx ON vaccinations(pet_id);

CREATE INDEX IF NOT EXISTS appointment_owner_idx ON appointments(owner_email);

CREATE INDEX IF NOT EXISTS appointment_partner_idx ON appointments(partner_id, scheduled_at);

CREATE UNIQUE INDEX IF NOT EXISTS appointment_active_slot_unique ON appointments(owner_email, pet_id, partner_id, scheduled_at) WHERE status IN ('pending','confirmed');

CREATE INDEX IF NOT EXISTS medical_record_pet_idx ON medical_records(pet_id, visited_at);

CREATE UNIQUE INDEX IF NOT EXISTS medical_record_appointment_unique ON medical_records(appointment_id);

CREATE INDEX IF NOT EXISTS product_partner_idx ON products(partner_id);

CREATE INDEX IF NOT EXISTS order_owner_idx ON orders(owner_email, created_at);

CREATE INDEX IF NOT EXISTS order_partner_idx ON orders(partner_id, created_at);

CREATE INDEX IF NOT EXISTS order_item_order_idx ON order_items(order_id);

CREATE INDEX IF NOT EXISTS audit_rate_idx ON audit_logs(actor_email, action, created_at);
