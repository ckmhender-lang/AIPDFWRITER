import { type FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';

export type JwtUser = {
  sub: string;
  email: string;
  role: 'user' | 'admin';
};

declare module '@fastify/jwt' {
  interface FastifyJWT {
    user: JwtUser;
    payload: JwtUser;
  }
}

export const authPlugin: FastifyPluginAsync = fp(async (app) => {
  // Guard all /v1 routes except auth
  app.addHook('onRequest', async (req) => {
    if (!req.url.startsWith('/v1')) return;
    if (req.url.startsWith('/v1/auth')) return;

    try {
      await req.jwtVerify<JwtUser>();
    } catch {
      const err = new Error('Unauthorized');
      (err as unknown as { statusCode?: number; code?: string }).statusCode = 401;
      (err as unknown as { statusCode?: number; code?: string }).code = 'UNAUTHORIZED';
      throw err;
    }
  });
});
