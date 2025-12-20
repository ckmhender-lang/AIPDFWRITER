import Fastify, { type FastifyServerOptions } from 'fastify';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import cors from '@fastify/cors';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import cookie from '@fastify/cookie';
import jwt from '@fastify/jwt';
import multipart from '@fastify/multipart';

import { healthRoutes } from './routes/health.js';
import { documentsRoutes } from './routes/documents.js';
import { authRoutes } from './routes/auth.js';
import { assetsRoutes } from './routes/assets.js';
import { pdfOpsRoutes } from './routes/pdfOps.js';
import { analyticsRoutes } from './routes/analytics.js';
import { publicShareRoutes, sharesRoutes } from './routes/shares.js';
import { webhooksRoutes } from './routes/webhooks.js';
import { billingRoutes } from './routes/billing.js';
import { uiRoutes } from './routes/ui.js';
import { authPlugin } from './plugins/auth.js';

export type BuildAppOptions = {
  logger?: FastifyServerOptions['logger'];
};

export async function buildApp(options: BuildAppOptions) {
  const fastifyOptions: FastifyServerOptions = {
    genReqId: () => crypto.randomUUID(),
  };
  if (options.logger !== undefined) {
    fastifyOptions.logger = options.logger;
  }

  const app = Fastify(fastifyOptions);

  // Baseline hardening
  await app.register(helmet);
  await app.register(cors, {
    origin: false,
  });
  await app.register(rateLimit, {
    max: 120,
    timeWindow: '1 minute',
  });

  await app.register(cookie);
  await app.register(jwt, {
    secret: process.env.JWT_SECRET ?? 'dev-secret-change-me',
  });
  await app.register(multipart, {
    limits: {
      fileSize: 25 * 1024 * 1024,
    },
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
      message:
        statusCode === 500
          ? 'Internal server error'
          : err instanceof Error
            ? err.message
            : 'Request failed',
      requestId: req.id,
    });
  });

  // Routes
  await app.register(healthRoutes);
  await app.register(authPlugin);
  await app.register(authRoutes, { prefix: '/v1' });
  await app.register(documentsRoutes, { prefix: '/v1' });
  await app.register(assetsRoutes, { prefix: '/v1' });
  await app.register(pdfOpsRoutes, { prefix: '/v1' });
  await app.register(sharesRoutes, { prefix: '/v1' });
  await app.register(analyticsRoutes, { prefix: '/v1' });
  await app.register(webhooksRoutes, { prefix: '/v1' });
  await app.register(billingRoutes, { prefix: '/v1' });
  await app.register(publicShareRoutes);
  await app.register(uiRoutes);

  return app;
}
