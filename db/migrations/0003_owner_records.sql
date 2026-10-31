CREATE TABLE IF NOT EXISTS owner_product_drafts (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  proposed_price INTEGER NOT NULL CHECK (proposed_price > 0),
  image_url TEXT NOT NULL,
  stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status = 'draft'),
  description TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS owner_payment_history (
  id TEXT PRIMARY KEY,
  amount INTEGER NOT NULL CHECK (amount <> 0),
  transaction_date DATE,
  displayed_time TEXT NOT NULL,
  description TEXT NOT NULL,
  classification TEXT NOT NULL CHECK (classification IN ('petcare_receipt','unclassified_receipt','outgoing')),
  source_reference TEXT NOT NULL UNIQUE,
  verification TEXT NOT NULL DEFAULT 'imported_screenshot' CHECK (verification = 'imported_screenshot'),
  imported_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE owner_product_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE owner_payment_history ENABLE ROW LEVEL SECURITY;
