ALTER TABLE orders DROP CONSTRAINT orders_order_status_check;

UPDATE orders SET order_status = CASE
  WHEN order_status = 'confirmed' THEN 'new'
  WHEN order_status IN ('preparing', 'ready') THEN 'scheduled'
  ELSE order_status
END;

ALTER TABLE orders
  ADD COLUMN delivery_date DATE,
  ADD COLUMN status_changed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD CONSTRAINT orders_order_status_check CHECK (
    order_status IN ('new','pending_payment','paid','scheduled','en_route','delivered','cancelled')
  );

CREATE TABLE order_status_history (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  from_status TEXT,
  to_status TEXT NOT NULL CHECK (
    to_status IN ('new','pending_payment','paid','scheduled','en_route','delivered','cancelled')
  ),
  changed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  changed_by TEXT NOT NULL CHECK (changed_by IN ('system','admin'))
);

INSERT INTO order_status_history (id, order_id, from_status, to_status, changed_at, changed_by)
SELECT gen_random_uuid()::TEXT, id, NULL, order_status, created_at, 'system' FROM orders;

CREATE INDEX order_status_history_order_idx ON order_status_history (order_id, changed_at DESC);
