import { type FastifyPluginAsync } from 'fastify';
import { listEvents, trackEvent } from '../services/analytics.js';
import {
  createWebhook,
  deleteWebhook,
  deliverWebhookEvent,
  listDeliveries,
  listWebhooks,
} from '../services/webhooks.js';

const errorSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['code', 'message', 'requestId'],
  properties: {
    code: { type: 'string' },
    message: { type: 'string' },
    requestId: { type: 'string' },
  },
} as const;

export const webhooksRoutes: FastifyPluginAsync = async (app) => {
  app.get(
    '/webhooks',
    {
      schema: {
        description: 'List configured webhooks',
        response: {
          200: { type: 'object', additionalProperties: false, required: ['items'], properties: { items: { type: 'array', items: { type: 'object', additionalProperties: true } } } },
        },
      },
    },
    async (req) => {
      const items = listWebhooks(req.user.sub).map((w) => ({
        id: w.id,
        url: w.url,
        events: w.events,
        createdAt: w.createdAt,
      }));
      return { items };
    },
  );

  app.post(
    '/webhooks',
    {
      schema: {
        description: 'Create a webhook',
        body: {
          type: 'object',
          additionalProperties: false,
          required: ['url', 'events'],
          properties: {
            url: { type: 'string', minLength: 8, maxLength: 2000 },
            events: { type: 'array', items: { type: 'string', minLength: 1, maxLength: 100 }, minItems: 1 },
          },
        },
        response: {
          201: { type: 'object', additionalProperties: false, required: ['id', 'secret'], properties: { id: { type: 'string' }, secret: { type: 'string' } } },
        },
      },
    },
    async (req, reply) => {
      const body = req.body as { url: string; events: string[] };
      const w = createWebhook({ ownerUserId: req.user.sub, url: body.url, events: body.events });
      trackEvent({ type: 'webhook.created', userId: req.user.sub, data: { webhookId: w.id } });
      return reply.status(201).send({ id: w.id, secret: w.secret });
    },
  );

  app.delete(
    '/webhooks/:id',
    {
      schema: {
        description: 'Delete a webhook',
        params: { type: 'object', additionalProperties: false, required: ['id'], properties: { id: { type: 'string' } } },
        response: { 204: { type: 'null' }, 404: errorSchema },
      },
    },
    async (req, reply) => {
      const { id } = req.params as { id: string };
      const ok = deleteWebhook(req.user.sub, id);
      if (!ok) return reply.status(404).send({ code: 'NOT_FOUND', message: 'Not found', requestId: req.id });
      trackEvent({ type: 'webhook.deleted', userId: req.user.sub, data: { webhookId: id } });
      return reply.status(204).send();
    },
  );

  app.get(
    '/webhooks/deliveries',
    {
      schema: {
        description: 'List recent webhook deliveries',
        querystring: { type: 'object', additionalProperties: false, required: [], properties: { limit: { type: 'integer', minimum: 1, maximum: 500 } } },
        response: { 200: { type: 'object', additionalProperties: false, required: ['items'], properties: { items: { type: 'array', items: { type: 'object', additionalProperties: true } } } } },
      },
    },
    async (req) => {
      const q = req.query as { limit?: number };
      return { items: listDeliveries(req.user.sub, q.limit ?? 50) };
    },
  );

  // MVP endpoint: trigger delivery of the most recent analytics event to all matching webhooks
  app.post(
    '/webhooks/dispatch-latest',
    {
      schema: {
        description: 'Dispatch the latest tracked event to matching webhooks (MVP/manual)',
        response: {
          200: { type: 'object', additionalProperties: false, required: ['delivered'], properties: { delivered: { type: 'integer' } } },
        },
      },
    },
    async (req) => {
      const latest = listEvents(1)[0];
      if (!latest) return { delivered: 0 };

      const hooks = listWebhooks(req.user.sub).filter((w) => w.events.includes(latest.type));
      await Promise.all(
        hooks.map((w) =>
          deliverWebhookEvent({
            webhook: w,
            event: { id: latest.id, type: latest.type, createdAt: latest.createdAt, data: latest.data },
          }),
        ),
      );

      return { delivered: hooks.length };
    },
  );
};
