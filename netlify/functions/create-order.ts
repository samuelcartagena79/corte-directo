import type { Config } from '@netlify/functions';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { COMBO_CATALOG } from '../../lib/orders';
import { database } from './_shared/db';
import { assertSameOrigin, json } from './_shared/http';
import {
  dispatchNotifications,
  enqueueNotification,
} from './_shared/notifications';

const cities = [
  'Tallahassee',
  'Monticello',
  'Live Oak',
  'Lake City',
  'Perry',
  'Madison',
] as const;
const schema = z.object({
  idempotencyKey: z.uuid(),
  name: z.string().trim().min(2).max(120),
  phone: z
    .string()
    .trim()
    .min(7)
    .max(30)
    .regex(/^[0-9+().\-\s]+$/),
  city: z.enum(cities),
  zip: z.string().regex(/^\d{5}$/),
  address: z.string().trim().min(5).max(180),
  combo: z.enum(['CD-PARRILLERO', 'CD-FAMILIAR', 'CD-PREMIUM']),
  quantity: z.coerce.number().int().min(1).max(20),
  chorizo: z.enum(['Chorizo Argentino', 'Salchicha Parrillera']).optional(),
  gift: z.enum(['Chicharrón', 'Manteca de Cerdo']).optional(),
  paymentMethod: z.literal('cash_on_delivery'),
});

export default async function handler(request: Request) {
  if (request.method !== 'POST')
    return json({ error: 'Método no permitido.' }, 405);
  try {
    assertSameOrigin(request);
    const input = schema.parse(await request.json());
    if (input.combo === 'CD-PARRILLERO' && (!input.chorizo || !input.gift))
      return json({ error: 'Selecciona el chorizo y el regalo.' }, 400);
    const sql = database();
    const existing = await sql<
      { order_number: string; total: string }[]
    >`SELECT order_number,total::TEXT FROM orders WHERE idempotency_key=${input.idempotencyKey}`;
    if (existing[0]) return json({ order: existing[0], duplicate: true });
    const catalogItem = COMBO_CATALOG[input.combo];
    const total = catalogItem.unitPrice * input.quantity;
    const orderId = randomUUID();
    const result = await sql.begin(async (tx) => {
      const sequence = await tx<
        { value: string }[]
      >`SELECT nextval('order_number_seq')::TEXT AS value`;
      const orderNumber = `CD-${sequence[0].value.padStart(6, '0')}`;
      const historyId = randomUUID();
      await tx`INSERT INTO orders(id,order_number,idempotency_key,customer_name,phone,city,zip,address,total,payment_method,payment_status,order_status) VALUES(${orderId},${orderNumber},${input.idempotencyKey},${input.name},${input.phone},${input.city},${input.zip},${input.address},${total},'cash_on_delivery','pending','new')`;
      await tx`INSERT INTO order_items(order_id,product_code,product_name,quantity,unit_price,line_total,options) VALUES(${orderId},${input.combo},${catalogItem.name},${input.quantity},${catalogItem.unitPrice},${total},${tx.json({ chorizo: input.chorizo || '', gift: input.gift || '' })})`;
      await tx`INSERT INTO order_status_history(id,order_id,from_status,to_status,changed_by) VALUES(${historyId},${orderId},NULL,'new','system')`;
      for (const target of [
        { channel: 'sms', audience: 'customer' },
        { channel: 'sms', audience: 'owner' },
        { channel: 'email', audience: 'owner' },
      ] as const)
        await enqueueNotification(tx, {
          id: randomUUID(),
          orderId,
          historyId,
          event: 'order_created',
          ...target,
        });
      return { order_number: orderNumber, total: total.toFixed(2) };
    });
    try {
      await dispatchNotifications(request);
    } catch (error) {
      console.error('notification dispatch failed', error);
    }
    return json({ order: result, duplicate: false }, 201);
  } catch (error) {
    if (error instanceof z.ZodError)
      return json({ error: 'Revisa los datos de la orden.' }, 400);
    if (error instanceof Error && error.message === 'INVALID_ORIGIN')
      return json({ error: 'Origen no autorizado.' }, 403);
    if (
      typeof error === 'object' &&
      error &&
      'code' in error &&
      error.code === '23505'
    )
      return json({ error: 'La orden ya fue registrada.' }, 409);
    console.error('create-order failed', error);
    return json(
      { error: 'No pudimos guardar la orden. Intenta nuevamente.' },
      500,
    );
  }
}

export const config: Config = {
  path: '/api/orders',
  rateLimit: { windowSize: 60, windowLimit: 10, aggregateBy: 'ip' },
};
