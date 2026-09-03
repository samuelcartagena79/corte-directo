import type postgres from 'postgres';
import { database } from './db';

type EventType = 'order_created' | 'en_route' | 'delivered';
type Channel = 'sms' | 'email';
type Audience = 'customer' | 'owner';

export async function enqueueNotification(
  tx: postgres.TransactionSql,
  input: {
    id: string;
    orderId: string;
    historyId: string;
    event: EventType;
    channel: Channel;
    audience: Audience;
  },
) {
  const eventIdentity =
    input.event === 'order_created' ? 'created' : input.historyId;
  const dedupeKey = [
    input.orderId,
    input.event,
    input.channel,
    input.audience,
    eventIdentity,
  ].join(':');
  await tx`INSERT INTO notification_outbox(id,order_id,status_history_id,event_type,channel,audience,dedupe_key)
    VALUES(${input.id},${input.orderId},${input.historyId},${input.event},${input.channel},${input.audience},${dedupeKey})
    ON CONFLICT(dedupe_key) DO NOTHING`;
}

export async function dispatchNotifications(request: Request) {
  if ((process.env.NOTIFICATIONS_MODE || 'disabled') === 'disabled') return;
  const secret = process.env.NOTIFICATION_DISPATCH_SECRET;
  if (!secret) return;
  const url = new URL('/api/internal/process-notifications', request.url);
  await fetch(url, {
    method: 'POST',
    headers: { authorization: `Bearer ${secret}` },
    signal: AbortSignal.timeout(2500),
  });
}

function normalizePhone(value: string) {
  const digits = value.replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  if (value.startsWith('+') && digits.length >= 10 && digits.length <= 15)
    return `+${digits}`;
  throw new Error('El teléfono no tiene un formato válido para SMS.');
}

type Job = {
  id: string;
  dedupe_key: string;
  event_type: EventType;
  channel: Channel;
  audience: Audience;
  order_number: string;
  customer_name: string;
  phone: string;
  city: string;
  total: string;
};

function notificationText(job: Job) {
  if (job.audience === 'owner')
    return `Nueva orden ${job.order_number}: ${job.customer_name}, ${job.city}, $${Number(job.total).toFixed(2)}.`;
  if (job.event_type === 'en_route')
    return `Corte Directo: tu orden ${job.order_number} va en camino. Gracias por tu compra.`;
  if (job.event_type === 'delivered')
    return `Corte Directo: confirmamos la entrega de tu orden ${job.order_number}. Gracias por elegirnos.`;
  return `Corte Directo: recibimos tu orden ${job.order_number} por $${Number(job.total).toFixed(2)}. Te contactaremos para confirmar disponibilidad.`;
}

async function sendSms(job: Job) {
  const account = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const service = process.env.TWILIO_MESSAGING_SERVICE_SID;
  const destination =
    job.audience === 'owner' ? process.env.OWNER_PHONE_E164 : job.phone;
  if (!account || !token || !service || !destination)
    throw new Error('Configuración de Twilio incompleta.');
  const body = new URLSearchParams({
    To: normalizePhone(destination),
    MessagingServiceSid: service,
    Body: notificationText(job),
  });
  const response = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${account}/Messages.json`,
    {
      method: 'POST',
      headers: {
        authorization: `Basic ${Buffer.from(`${account}:${token}`).toString('base64')}`,
        'content-type': 'application/x-www-form-urlencoded',
      },
      body,
    },
  );
  const result = (await response.json()) as { sid?: string; message?: string };
  if (!response.ok)
    throw new Error(result.message || `Twilio respondió ${response.status}`);
  return result.sid || null;
}

async function sendEmail(job: Job) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  const to = process.env.OWNER_EMAIL;
  if (!apiKey || !from || !to)
    throw new Error('Configuración de Resend incompleta.');
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json',
      'Idempotency-Key': job.dedupe_key,
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject: `Nueva orden ${job.order_number}`,
      text: notificationText(job),
    }),
  });
  const result = (await response.json()) as { id?: string; message?: string };
  if (!response.ok)
    throw new Error(result.message || `Resend respondió ${response.status}`);
  return result.id || null;
}

export async function processPendingNotifications() {
  const sql = database();
  const jobs = await sql.begin(async (tx) => {
    const rows = await tx<
      Job[]
    >`SELECT n.id,n.dedupe_key,n.event_type,n.channel,n.audience,
      o.order_number,o.customer_name,o.phone,o.city,o.total::TEXT
      FROM notification_outbox n JOIN orders o ON o.id=n.order_id
      WHERE n.status='pending' OR
        (n.status='processing' AND n.locked_at<CURRENT_TIMESTAMP-INTERVAL '10 minutes')
      ORDER BY n.created_at FOR UPDATE OF n SKIP LOCKED LIMIT 25`;
    if (rows.length)
      await tx`UPDATE notification_outbox SET status='processing',attempts=attempts+1,
        locked_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP
        WHERE id=ANY(${rows.map((row) => row.id)})`;
    return rows;
  });
  const mode = process.env.NOTIFICATIONS_MODE || 'disabled';
  for (const job of jobs) {
    try {
      let providerId: string | null = null;
      if (mode === 'log') providerId = `local-${job.id}`;
      else if (mode === 'live')
        providerId =
          job.channel === 'sms' ? await sendSms(job) : await sendEmail(job);
      else throw new Error('Modo de notificaciones no habilitado.');
      await sql`UPDATE notification_outbox SET status='sent',sent_at=CURRENT_TIMESTAMP,
        provider_message_id=${providerId},last_error=NULL,updated_at=CURRENT_TIMESTAMP
        WHERE id=${job.id}`;
    } catch (error) {
      const reason =
        error instanceof Error ? error.message : 'Error desconocido';
      await sql`UPDATE notification_outbox SET status='failed',last_error=${reason.slice(0, 500)},
        updated_at=CURRENT_TIMESTAMP WHERE id=${job.id}`;
    }
  }
  return jobs.length;
}
