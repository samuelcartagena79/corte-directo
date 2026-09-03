export const ORDER_STATUSES = [
  'new',
  'pending_payment',
  'paid',
  'scheduled',
  'en_route',
  'delivered',
  'cancelled',
] as const;
export const PAYMENT_STATUSES = [
  'pending',
  'paid',
  'refunded',
  'failed',
] as const;
export const PAYMENT_METHODS = ['cash_on_delivery', 'card_stripe'] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];
export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  new: 'Nueva',
  pending_payment: 'Pendiente de pago',
  paid: 'Pagada',
  scheduled: 'Programada',
  en_route: 'En ruta',
  delivered: 'Entregada',
  cancelled: 'Cancelada',
};
export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  pending: 'Pendiente',
  paid: 'Pagado',
  refunded: 'Reembolsado',
  failed: 'Fallido',
};
export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash_on_delivery: 'Cash on Delivery',
  card_stripe: 'Card / Stripe',
};
export const COMBO_CATALOG = {
  'CD-PARRILLERO': { name: 'Combo #1 — Parrillero', unitPrice: 200 },
  'CD-FAMILIAR': { name: 'Combo #2 — Familiar', unitPrice: 176 },
  'CD-PREMIUM': { name: 'Combo #3 — Premium', unitPrice: 242 },
} as const;
export type AdminOrder = {
  id: string;
  order_number: string;
  created_at: string;
  customer_name: string;
  phone: string;
  city: string;
  zip: string;
  address: string;
  total: string;
  payment_method: PaymentMethod;
  payment_status: PaymentStatus;
  order_status: OrderStatus;
  delivery_date: string | null;
  status_changed_at: string;
  items: Array<{
    product_code: string;
    product_name: string;
    quantity: number;
    unit_price: string;
    line_total: string;
    options: Record<string, string>;
  }>;
  status_history: Array<{
    id: string;
    from_status: OrderStatus | null;
    to_status: OrderStatus;
    changed_at: string;
    changed_by: 'system' | 'admin';
  }>;
};
