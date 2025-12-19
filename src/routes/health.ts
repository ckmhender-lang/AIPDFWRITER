import { type FastifyPluginCallback } from 'fastify';

export const healthRoutes: FastifyPluginCallback = (app, _opts, done) => {
  app.get(
    '/health',
    {
      schema: {
        description: 'Health check',
        response: {
          200: {
            type: 'object',
            additionalProperties: false,
            required: ['ok'],
            properties: {
              ok: { type: 'boolean' },
            },
          },
        },
      },
    },
    () => ({ ok: true }),
  );

  done();
};
