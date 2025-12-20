import { createHmac } from 'node:crypto';

export type Webhook = {
  id: string;
  ownerUserId: string;
  url: string;
  secret: string;
  events: string[];
  createdAt: string;
};

export type WebhookDelivery = {
  id: string;
  webhookId: string;
  eventId: string;
  status: 'success' | 'failed';
  statusCode: number | null;
  error: string | null;
  createdAt: string;
};

const webhooks = new Map<string, Webhook>();
const deliveries: WebhookDelivery[] = [];

export function createWebhook(input: {
  ownerUserId: string;
  url: string;
  events: string[];
}): Webhook {
  const w: Webhook = {
    id: `whk_${crypto.randomUUID()}`,
    ownerUserId: input.ownerUserId,
    url: input.url,
    secret: `whsec_${crypto.randomUUID()}`,
    events: input.events,
    createdAt: new Date().toISOString(),
  };
  webhooks.set(w.id, w);
  return w;
}

export function listWebhooks(ownerUserId: string): Webhook[] {
  return Array.from(webhooks.values()).filter((w) => w.ownerUserId === ownerUserId);
}

export function deleteWebhook(ownerUserId: string, id: string): boolean {
  const w = webhooks.get(id);
  if (!w) return false;
  if (w.ownerUserId !== ownerUserId) return false;
  webhooks.delete(id);
  return true;
}

export function listDeliveries(ownerUserId: string, limit = 50): WebhookDelivery[] {
  const ids = new Set(listWebhooks(ownerUserId).map((w) => w.id));
  return deliveries.filter((d) => ids.has(d.webhookId)).slice(0, Math.max(1, Math.min(500, limit)));
}

export async function deliverWebhookEvent(input: {
  webhook: Webhook;
  event: { id: string; type: string; createdAt: string; data: Record<string, unknown> };
}): Promise<WebhookDelivery> {
  const payload = JSON.stringify({
    id: input.event.id,
    type: input.event.type,
    createdAt: input.event.createdAt,
    data: input.event.data,
  });

  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signature = createHmac('sha256', input.webhook.secret)
    .update(`${timestamp}.${payload}`)
    .digest('hex');

  try {
    const res = await fetch(input.webhook.url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-webhook-id': input.webhook.id,
        'x-timestamp': timestamp,
        'x-signature': signature,
      },
      body: payload,
    });

    const delivery: WebhookDelivery = {
      id: `whd_${crypto.randomUUID()}`,
      webhookId: input.webhook.id,
      eventId: input.event.id,
      status: res.ok ? 'success' : 'failed',
      statusCode: res.status,
      error: res.ok ? null : `HTTP ${res.status}`,
      createdAt: new Date().toISOString(),
    };
    deliveries.unshift(delivery);
    if (deliveries.length > 5000) deliveries.length = 5000;
    return delivery;
  } catch (e) {
    const delivery: WebhookDelivery = {
      id: `whd_${crypto.randomUUID()}`,
      webhookId: input.webhook.id,
      eventId: input.event.id,
      status: 'failed',
      statusCode: null,
      error: e instanceof Error ? e.message : 'Delivery failed',
      createdAt: new Date().toISOString(),
    };
    deliveries.unshift(delivery);
    if (deliveries.length > 5000) deliveries.length = 5000;
    return delivery;
  }
}
