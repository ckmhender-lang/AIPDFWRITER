import Fastify, { type FastifyBaseLogger, type FastifyInstance } from 'fastify';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import cors from '@fastify/cors';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';

import { healthRoutes } from './routes/health.js';
import { documentsRoutes } from './routes/documents.js';

export type BuildAppOptions = {
  logger: boolean | FastifyBaseLogger;
};

export async function buildApp(options: BuildAppOptions): Promise<FastifyInstance> {
  const app = Fastify({
    logger: options.logger,
    genReqId: () => crypto.randomUUID(),
  });

  // Baseline hardening
  await app.register(helmet);
  await app.register(cors, {
    origin: false,
  });
  await app.register(rateLimit, {
    max: 120,
    timeWindow: '1 minute',
  });

  // OpenAPI via route schemas (keeps contract close to code)
  await app.register(swagger, {
    openapi: {
      info: {
        title: 'PDF App Generator API',
        version: '0.1.0',
      },
    },
  });

  await app.register(swaggerUi, {
    routePrefix: '/docs',
  });

  // Consistent error format
  app.setErrorHandler((err, req, reply) => {
    const maybeStatusCode = (err as unknown as { statusCode?: unknown }).statusCode;
    const statusCode =
      typeof maybeStatusCode === 'number' && maybeStatusCode >= 400 ? maybeStatusCode : 500;

    const maybeCode = (err as unknown as { code?: unknown }).code;
    const code = typeof maybeCode === 'string' ? maybeCode : 'INTERNAL_ERROR';

    req.log.error(
      {
        err,
        requestId: req.id,
      },
      'request failed',
    );

    void reply.status(statusCode).send({
      code,
      message: statusCode === 500 ? 'Internal server error' : err.message,
      requestId: req.id,
    });
  });

  // Routes
  await app.register(healthRoutes);
  await app.register(documentsRoutes, { prefix: '/v1' });

  return app;
}
