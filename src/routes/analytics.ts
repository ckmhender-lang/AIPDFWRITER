import { type FastifyPluginAsync } from 'fastify';
import { listEvents, trackEvent } from '../services/analytics.js';

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

export const analyticsRoutes: FastifyPluginAsync = async (app) => {
  app.post(
    '/analytics/events',
    {
      schema: {
        description: 'Ingest a client-side analytics event',
        body: {
          type: 'object',
          additionalProperties: false,
          required: ['type'],
          properties: {
            type: { type: 'string', minLength: 1, maxLength: 100 },
            data: { type: 'object', additionalProperties: true },
          },
        },
        response: {
          202: { type: 'object', additionalProperties: false, required: ['ok'], properties: { ok: { type: 'boolean' } } },
        },
      },
    },
    async (req, reply) => {
      const body = req.body as { type: string; data?: Record<string, unknown> };
      trackEvent({
        type: body.type,
        userId: req.user.sub,
        ...(body.data !== undefined ? { data: body.data } : {}),
      });
      return reply.status(202).send({ ok: true });
    },
  );

  app.get(
    '/analytics/events',
    {
      schema: {
        description: 'List recent analytics events (MVP; should be admin-only)',
        querystring: {
          type: 'object',
          additionalProperties: false,
          required: [],
          properties: { limit: { type: 'integer', minimum: 1, maximum: 1000 } },
        },
        response: {
          200: { type: 'object', additionalProperties: false, required: ['items'], properties: { items: { type: 'array', items: { type: 'object', additionalProperties: true } } } },
          403: errorSchema,
        },
      },
    },
    async (req, reply) => {
      // Basic role check
      if (req.user.role !== 'admin') {
        return reply.status(403).send({ code: 'FORBIDDEN', message: 'Admin only', requestId: req.id });
      }
      const q = req.query as { limit?: number };
      return reply.send({ items: listEvents(q.limit ?? 100) });
    },
  );
};
