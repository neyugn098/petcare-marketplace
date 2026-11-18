CREATE TABLE owner_demo_sales_history (
 id TEXT PRIMARY KEY,
 is_simulated BOOLEAN NOT NULL DEFAULT true CHECK (is_simulated = true),
 transaction_date DATE NOT NULL,
 displayed_time TIME NOT NULL,
 product_name TEXT NOT NULL,
 quantity INTEGER NOT NULL CHECK (quantity > 0),
 unit_price INTEGER NOT NULL CHECK (unit_price > 0),
 amount INTEGER NOT NULL CHECK (amount = quantity * unit_price),
 description TEXT NOT NULL,
 payment_method TEXT NOT NULL CHECK (payment_method IN ('cod','transfer')),
 source_reference TEXT NOT NULL DEFAULT 'SIMULATED — not bank evidence'
);
ALTER TABLE owner_demo_sales_history ENABLE ROW LEVEL SECURITY;
