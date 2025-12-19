import { buildApp } from './app.js';

const port = Number.parseInt(process.env.PORT ?? '3000', 10);
const host = process.env.HOST ?? '0.0.0.0';

const app = await buildApp({
  logger:
    process.env.NODE_ENV === 'test'
      ? false
      : {
          level: process.env.LOG_LEVEL ?? 'info',
        },
});

await app.listen({ port, host });

app.log.info({ port, host }, 'server listening');
