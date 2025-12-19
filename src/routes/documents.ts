import { type FastifyPluginCallback } from 'fastify';

type Document = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
};

const documents = new Map<string, Document>();

export const documentsRoutes: FastifyPluginCallback = (app, _opts, done) => {
  app.get(
    '/documents',
    {
      schema: {
        description: 'List documents (stubbed in-memory for kickoff)',
        response: {
          200: {
            type: 'object',
            additionalProperties: false,
            required: ['items', 'nextCursor'],
            properties: {
              items: {
                type: 'array',
                items: {
                  type: 'object',
                  additionalProperties: false,
                  required: ['id', 'title', 'createdAt', 'updatedAt'],
                  properties: {
                    id: { type: 'string' },
                    title: { type: 'string' },
                    createdAt: { type: 'string' },
                    updatedAt: { type: 'string' },
                  },
                },
              },
              nextCursor: { type: ['string', 'null'] },
            },
          },
        },
      },
    },
    () => ({
      items: Array.from(documents.values()),
      nextCursor: null,
    }),
  );

  app.post(
    '/documents',
    {
      schema: {
        description: 'Create a new document (stubbed in-memory for kickoff)',
        body: {
          type: 'object',
          additionalProperties: false,
          required: ['title'],
          properties: {
            title: { type: 'string', minLength: 1, maxLength: 120 },
          },
        },
        response: {
          201: {
            type: 'object',
            additionalProperties: false,
            required: ['id', 'title', 'createdAt', 'updatedAt'],
            properties: {
              id: { type: 'string' },
              title: { type: 'string' },
              createdAt: { type: 'string' },
              updatedAt: { type: 'string' },
            },
          },
        },
      },
    },
    (req, reply) => {
      const { title } = req.body as { title: string };
      const now = new Date().toISOString();
      const doc: Document = {
        id: `doc_${crypto.randomUUID()}`,
        title,
        createdAt: now,
        updatedAt: now,
      };
      documents.set(doc.id, doc);
      return reply.status(201).send(doc);
    },
  );

  done();
};
