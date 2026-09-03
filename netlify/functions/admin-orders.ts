import type { Config } from '@netlify/functions';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { ORDER_STATUSES, PAYMENT_STATUSES } from '../../lib/orders';
import { requireAdmin } from './_shared/auth';
import { database } from './_shared/db';
import { assertSameOrigin, json } from './_shared/http';
import {
  dispatchNotifications,
  enqueueNotification,
} from './_shared/notifications';

const updateSchema = z
  .object({
    orderId: z.uuid(),
    orderStatus: z.enum(ORDER_STATUSES).optional(),
    paymentStatus: z.enum(PAYMENT_STATUSES).optional(),
    deliveryDate: z.iso.date().nullable().optional(),
  })
  .refine(
    (value) =>
      value.orderStatus ||
      value.paymentStatus ||
      value.deliveryDate !== undefined,
  );
const filterSchema = z.object({
  status: z.enum(ORDER_STATUSES).optional(),
  city: z.string().trim().max(80).optional(),
  deliveryDate: z.iso.date().optional(),
});

export default async function handler(request: Request) {
  try {
    if (!requireAdmin(request)) return json({ error: 'No autorizado.' }, 401);
    const sql = database();
    if (request.method === 'GET') {
      const url = new URL(request.url);
      const filters = filterSchema.parse({
        status: url.searchParams.get('status') || undefined,
        city: url.searchParams.get('city') || undefined,
        deliveryDate: url.searchParams.get('deliveryDate') || undefined,
      });
      const orders =
        await sql`SELECT o.id,o.order_number,o.created_at,o.customer_name,o.phone,o.city,o.zip,o.address,o.total::TEXT,o.payment_method,o.payment_status,o.order_status,o.delivery_date::TEXT,o.status_changed_at,
        COALESCE((SELECT json_agg(json_build_object('product_code',i.product_code,'product_name',i.product_name,'quantity',i.quantity,'unit_price',i.unit_price::TEXT,'line_total',i.line_total::TEXT,'options',i.options) ORDER BY i.id) FROM order_items i WHERE i.order_id=o.id),'[]'::json) AS items,
        COALESCE((SELECT json_agg(json_build_object('id',h.id,'from_status',h.from_status,'to_status',h.to_status,'changed_at',h.changed_at,'changed_by',h.changed_by) ORDER BY h.changed_at DESC) FROM order_status_history h WHERE h.order_id=o.id),'[]'::json) AS status_history
        FROM orders o WHERE (${filters.status || null}::TEXT IS NULL OR o.order_status=${filters.status || null}) AND (${filters.city || null}::TEXT IS NULL OR o.city=${filters.city || null}) AND (${filters.deliveryDate || null}::DATE IS NULL OR o.delivery_date=${filters.deliveryDate || null}::DATE) ORDER BY o.created_at DESC`;
      const cash = await sql<
        { total: string }[]
      >`SELECT COALESCE(SUM(total),0)::TEXT AS total FROM orders WHERE payment_method='cash_on_delivery' AND payment_status='pending' AND order_status<>'cancelled'`;
      const cities = await sql<
        { city: string }[]
      >`SELECT DISTINCT city FROM orders ORDER BY city`;
      return json({
        orders,
        cashReceivable: cash[0]?.total || '0',
        cities: cities.map((row) => row.city),
      });
    }
    if (request.method !== 'PATCH')
      return json({ error: 'Método no permitido.' }, 405);
    assertSameOrigin(request);
    const input = updateSchema.parse(await request.json());
    const updated = await sql.begin(async (tx) => {
      const current = (
        await tx<
          {
            id: string;
            order_number: string;
            order_status: (typeof ORDER_STATUSES)[number];
            payment_status: string;
            delivery_date: string | null;
          }[]
        >`SELECT id,order_number,order_status,payment_status,delivery_date::TEXT FROM orders WHERE id=${input.orderId} FOR UPDATE`
      )[0];
      if (!current) return null;
      if (
        input.orderStatus === 'scheduled' &&
        !input.deliveryDate &&
        !current.delivery_date
      )
        throw new Error('DELIVERY_DATE_REQUIRED');
      const nextPayment =
        input.orderStatus === 'paid'
          ? 'paid'
          : input.orderStatus === 'pending_payment'
            ? 'pending'
            : input.paymentStatus || current.payment_status;
      const deliveryDate =
        input.deliveryDate === undefined
          ? current.delivery_date
          : input.deliveryDate;
      await tx`UPDATE orders SET order_status=${input.orderStatus || current.order_status},payment_status=${nextPayment},delivery_date=${deliveryDate},status_changed_at=CASE WHEN ${input.orderStatus || null}::TEXT IS NOT NULL AND order_status<>${input.orderStatus || current.order_status} THEN CURRENT_TIMESTAMP ELSE status_changed_at END WHERE id=${input.orderId}`;
      if (input.orderStatus && input.orderStatus !== current.order_status) {
        const historyId = randomUUID();
        await tx`INSERT INTO order_status_history(id,order_id,from_status,to_status,changed_by) VALUES(${historyId},${input.orderId},${current.order_status},${input.orderStatus},'admin')`;
        if (
          input.orderStatus === 'en_route' ||
          input.orderStatus === 'delivered'
        )
          await enqueueNotification(tx, {
            id: randomUUID(),
            orderId: input.orderId,
            historyId,
            event: input.orderStatus,
            channel: 'sms',
            audience: 'customer',
          });
      }
      return {
        ...current,
        order_status: input.orderStatus || current.order_status,
        payment_status: nextPayment,
        delivery_date: deliveryDate,
      };
    });
    if (!updated) return json({ error: 'Orden no encontrada.' }, 404);
    try {
      await dispatchNotifications(request);
    } catch (error) {
      console.error('notification dispatch failed', error);
    }
    return json({ order: updated });
  } catch (error) {
    if (error instanceof z.ZodError)
      return json({ error: 'Solicitud o filtros inválidos.' }, 400);
    if (error instanceof Error && error.message === 'DELIVERY_DATE_REQUIRED')
      return json(
        { error: 'Indica una fecha de entrega antes de programar la orden.' },
        400,
      );
    if (error instanceof Error && error.message === 'INVALID_ORIGIN')
      return json({ error: 'Origen no autorizado.' }, 403);
    console.error('admin-orders failed', error);
    return json({ error: 'No fue posible procesar las órdenes.' }, 500);
  }
}

export const config: Config = {
  path: '/api/admin/orders',
  rateLimit: { windowSize: 60, windowLimit: 120, aggregateBy: 'ip' },
};
