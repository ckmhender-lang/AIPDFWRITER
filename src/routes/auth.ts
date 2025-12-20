import { type FastifyPluginAsync } from 'fastify';
import {
  consumePasswordResetToken,
  createPasswordResetToken,
  createUser,
  findUserByEmail,
  findUserById,
  toPublicUser,
  updateUserPassword,
  verifyPassword,
} from '../services/users.js';

export const authRoutes: FastifyPluginAsync = async (app) => {
  app.post(
    '/auth/register',
    {
      schema: {
        description: 'Register a new user (email/password)',
        body: {
          type: 'object',
          additionalProperties: false,
          required: ['email', 'password'],
          properties: {
            email: { type: 'string', minLength: 3, maxLength: 254 },
            password: { type: 'string', minLength: 8, maxLength: 200 },
            name: { type: ['string', 'null'], maxLength: 120 },
          },
        },
        response: {
          201: {
            type: 'object',
            additionalProperties: false,
            required: ['user', 'accessToken'],
            properties: {
              user: { type: 'object' },
              accessToken: { type: 'string' },
            },
          },
        },
      },
    },
    async (req, reply) => {
      const { email, password, name } = req.body as {
        email: string;
        password: string;
        name?: string | null;
      };

      const user = await createUser({
        email,
        password,
        ...(name !== undefined ? { name } : {}),
      });
      const accessToken = await reply.jwtSign({
        sub: user.id,
        email: user.email,
        role: user.role,
      });

      return reply.status(201).send({ user: toPublicUser(user), accessToken });
    },
  );

  app.post(
    '/auth/login',
    {
      schema: {
        description: 'Login (email/password)',
        body: {
          type: 'object',
          additionalProperties: false,
          required: ['email', 'password'],
          properties: {
            email: { type: 'string', minLength: 3, maxLength: 254 },
            password: { type: 'string', minLength: 1, maxLength: 200 },
          },
        },
        response: {
          200: {
            type: 'object',
            additionalProperties: false,
            required: ['user', 'accessToken'],
            properties: {
              user: { type: 'object' },
              accessToken: { type: 'string' },
            },
          },
        },
      },
    },
    async (req, reply) => {
      const { email, password } = req.body as { email: string; password: string };
      const user = findUserByEmail(email);
      if (!user) {
        const err = new Error('Invalid credentials');
        (err as unknown as { statusCode?: number; code?: string }).statusCode = 401;
        (err as unknown as { statusCode?: number; code?: string }).code = 'INVALID_CREDENTIALS';
        throw err;
      }

      const ok = await verifyPassword(user.passwordHash, password);
      if (!ok) {
        const err = new Error('Invalid credentials');
        (err as unknown as { statusCode?: number; code?: string }).statusCode = 401;
        (err as unknown as { statusCode?: number; code?: string }).code = 'INVALID_CREDENTIALS';
        throw err;
      }

      const accessToken = await reply.jwtSign({
        sub: user.id,
        email: user.email,
        role: user.role,
      });

      return reply.send({ user: toPublicUser(user), accessToken });
    },
  );

  app.post(
    '/auth/logout',
    {
      schema: {
        description: 'Logout (stateless JWT: client discards token)',
        response: {
          204: { type: 'null' },
        },
      },
    },
    async (_req, reply) => {
      return reply.status(204).send();
    },
  );

  app.get(
    '/me',
    {
      schema: {
        description: 'Get current user',
        response: {
          200: { type: 'object' },
        },
      },
    },
    async (req, reply) => {
      const user = findUserById(req.user.sub);
      if (!user) {
        const err = new Error('Unauthorized');
        (err as unknown as { statusCode?: number; code?: string }).statusCode = 401;
        (err as unknown as { statusCode?: number; code?: string }).code = 'UNAUTHORIZED';
        throw err;
      }
      return reply.send(toPublicUser(user));
    },
  );

  app.post(
    '/auth/password/forgot',
    {
      schema: {
        description: 'Request a password reset token (email is always accepted)',
        body: {
          type: 'object',
          additionalProperties: false,
          required: ['email'],
          properties: {
            email: { type: 'string', minLength: 3, maxLength: 254 },
          },
        },
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
    async (req, reply) => {
      const { email } = req.body as { email: string };
      const user = findUserByEmail(email);

      // Always return ok=true (avoid account enumeration)
      if (user) {
        const token = createPasswordResetToken(user.id, 60);
        // In production: send via email provider. For now: log it.
        req.log.info({ email: user.email, token: token.token, expiresAt: token.expiresAt }, 'password reset requested');
      }

      return reply.send({ ok: true });
    },
  );

  app.post(
    '/auth/password/reset',
    {
      schema: {
        description: 'Reset password using a reset token',
        body: {
          type: 'object',
          additionalProperties: false,
          required: ['token', 'newPassword'],
          properties: {
            token: { type: 'string', minLength: 10, maxLength: 200 },
            newPassword: { type: 'string', minLength: 8, maxLength: 200 },
          },
        },
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
    async (req, reply) => {
      const { token, newPassword } = req.body as { token: string; newPassword: string };
      const consumed = consumePasswordResetToken(token);
      await updateUserPassword(consumed.userId, newPassword);
      return reply.send({ ok: true });
    },
  );

  // Social logins: require provider configuration (client IDs/secrets)
  app.post(
    '/auth/oauth/:provider',
    {
      schema: {
        description: 'OAuth login (requires provider configuration; stub until configured)',
        params: {
          type: 'object',
          additionalProperties: false,
          required: ['provider'],
          properties: {
            provider: { type: 'string' },
          },
        },
        response: {
          501: {
            type: 'object',
            additionalProperties: false,
            required: ['code', 'message', 'requestId'],
            properties: {
              code: { type: 'string' },
              message: { type: 'string' },
              requestId: { type: 'string' },
            },
          },
        },
      },
    },
    async (req, reply) => {
      return reply.status(501).send({
        code: 'OAUTH_NOT_CONFIGURED',
        message: 'OAuth provider not configured yet. Provide client credentials to enable.',
        requestId: req.id,
      });
    },
  );
};
