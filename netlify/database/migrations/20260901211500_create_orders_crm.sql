CREATE SEQUENCE order_number_seq START WITH 1 INCREMENT BY 1;
CREATE TABLE orders (
  id TEXT PRIMARY KEY,
  order_number TEXT NOT NULL UNIQUE,
  idempotency_key TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  customer_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  city TEXT NOT NULL,
  zip TEXT NOT NULL,
  address TEXT NOT NULL,
  total NUMERIC(10,2) NOT NULL CHECK (total >= 0),
  payment_method TEXT NOT NULL CHECK (payment_method IN ('cash_on_delivery','card_stripe')),
  payment_status TEXT NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending','paid','refunded','failed')),
  order_status TEXT NOT NULL DEFAULT 'new' CHECK (order_status IN ('new','confirmed','preparing','ready','en_route','delivered','cancelled'))
);
CREATE TABLE order_items (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_code TEXT NOT NULL,
  product_name TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price NUMERIC(10,2) NOT NULL CHECK (unit_price >= 0),
  line_total NUMERIC(10,2) NOT NULL CHECK (line_total >= 0),
  options JSONB NOT NULL DEFAULT '{}'::JSONB
);
CREATE INDEX orders_created_at_idx ON orders (created_at DESC);
CREATE INDEX orders_status_idx ON orders (order_status);
CREATE INDEX orders_cash_receivable_idx ON orders (payment_method,payment_status,order_status);
CREATE INDEX order_items_order_id_idx ON order_items (order_id);
CREATE FUNCTION set_orders_updated_at() RETURNS TRIGGER LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at = CURRENT_TIMESTAMP; RETURN NEW; END; $$;
CREATE TRIGGER orders_updated_at_trigger BEFORE UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION set_orders_updated_at();
