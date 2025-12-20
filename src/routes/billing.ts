import { type FastifyPluginAsync } from 'fastify';

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

export const billingRoutes: FastifyPluginAsync = async (app) => {
  app.get(
    '/billing/me',
    {
      schema: {
        description: 'Get billing/subscription status (MVP stub)',
        response: {
          200: {
            type: 'object',
            additionalProperties: false,
            required: ['plan', 'status'],
            properties: {
              plan: { type: 'string' },
              status: { type: 'string' },
            },
          },
        },
      },
    },
    async (req) => {
      return {
        plan: (req.headers['x-plan'] as string | undefined) ?? 'free',
        status: 'active',
      };
    },
  );

  app.post(
    '/billing/checkout',
    {
      schema: {
        description: 'Create a checkout session (Stripe) (stub until STRIPE_SECRET_KEY configured)',
        body: {
          type: 'object',
          additionalProperties: false,
          required: ['plan'],
          properties: {
            plan: { type: 'string' },
          },
        },
        response: {
          501: errorSchema,
        },
      },
    },
    async (req, reply) => {
      return reply.status(501).send({
        code: 'PAYMENTS_NOT_CONFIGURED',
        message: 'Set STRIPE_SECRET_KEY and configure products/prices to enable checkout.',
        requestId: req.id,
      });
    },
  );
};
