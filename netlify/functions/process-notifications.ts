import type { Config } from '@netlify/functions';
import { processPendingNotifications } from './_shared/notifications';
import { json } from './_shared/http';

export default async function handler(request: Request) {
  if (request.method !== 'POST')
    return json({ error: 'Método no permitido.' }, 405);
  const secret = process.env.NOTIFICATION_DISPATCH_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`)
    return json({ error: 'No autorizado.' }, 401);
  const processed = await processPendingNotifications();
  return json({ processed }, 202);
}

export const config: Config = {
  path: '/api/internal/process-notifications',
  background: true,
};
