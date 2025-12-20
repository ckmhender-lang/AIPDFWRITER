import { type FastifyPluginCallback } from 'fastify';
import { getLimitsForPlan, getPlanFromHeaders } from '../limits.js';
import { generatePdf } from '../pdf/generatePdf.js';

type Document = {
  id: string;
  title: string;
  content: string;
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
      items: Array.from(documents.values()).map((d) => ({
        id: d.id,
        title: d.title,
        createdAt: d.createdAt,
        updatedAt: d.updatedAt,
      })),
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
          required: ['title', 'content'],
          properties: {
            title: { type: 'string', minLength: 1, maxLength: 120 },
            content: { type: 'string', minLength: 0, maxLength: 200_000 },
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
      const { title, content } = req.body as { title: string; content: string };
      const now = new Date().toISOString();
      const doc: Document = {
        id: `doc_${crypto.randomUUID()}`,
        title,
        content,
        createdAt: now,
        updatedAt: now,
      };
      documents.set(doc.id, doc);
      return reply.status(201).send({
        id: doc.id,
        title: doc.title,
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt,
      });
    },
  );

  app.get(
    '/documents/:id',
    {
      schema: {
        description: 'Get a document (metadata + content)',
        params: {
          type: 'object',
          additionalProperties: false,
          required: ['id'],
          properties: {
            id: { type: 'string' },
          },
        },
        response: {
          200: {
            type: 'object',
            additionalProperties: false,
            required: ['id', 'title', 'content', 'createdAt', 'updatedAt'],
            properties: {
              id: { type: 'string' },
              title: { type: 'string' },
              content: { type: 'string' },
              createdAt: { type: 'string' },
              updatedAt: { type: 'string' },
            },
          },
          404: {
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
    (req, reply) => {
      const { id } = req.params as { id: string };
      const doc = documents.get(id);
      if (!doc) return reply.status(404).send({ code: 'NOT_FOUND', message: 'Not found', requestId: req.id });
      return reply.send(doc);
    },
  );

  app.put(
    '/documents/:id',
    {
      schema: {
        description: 'Update a document title/content',
        params: {
          type: 'object',
          additionalProperties: false,
          required: ['id'],
          properties: {
            id: { type: 'string' },
          },
        },
        body: {
          type: 'object',
          additionalProperties: false,
          required: [],
          properties: {
            title: { type: 'string', minLength: 1, maxLength: 120 },
            content: { type: 'string', minLength: 0, maxLength: 200_000 },
          },
        },
        response: {
          200: {
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
          404: {
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
    (req, reply) => {
      const { id } = req.params as { id: string };
      const existing = documents.get(id);
      if (!existing)
        return reply.status(404).send({ code: 'NOT_FOUND', message: 'Not found', requestId: req.id });

      const body = req.body as { title?: string; content?: string };
      const updatedAt = new Date().toISOString();
      const updated: Document = {
        ...existing,
        title: body.title ?? existing.title,
        content: body.content ?? existing.content,
        updatedAt,
      };
      documents.set(id, updated);

      return reply.send({
        id: updated.id,
        title: updated.title,
        createdAt: updated.createdAt,
        updatedAt: updated.updatedAt,
      });
    },
  );

  app.get(
    '/documents/:id/download',
    {
      schema: {
        description: 'Download generated PDF for a document (generated on-demand)',
        params: {
          type: 'object',
          additionalProperties: false,
          required: ['id'],
          properties: {
            id: { type: 'string' },
          },
        },
        headers: {
          type: 'object',
          additionalProperties: true,
          properties: {
            'x-plan': { type: 'string' },
          },
        },
        response: {
          200: {
            description: 'PDF bytes',
            type: 'string',
            format: 'binary',
          },
          404: {
            type: 'object',
            additionalProperties: false,
            required: ['code', 'message', 'requestId'],
            properties: {
              code: { type: 'string' },
              message: { type: 'string' },
              requestId: { type: 'string' },
            },
          },
          413: {
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
      const { id } = req.params as { id: string };
      const doc = documents.get(id);
      if (!doc) return reply.status(404).send({ code: 'NOT_FOUND', message: 'Not found', requestId: req.id });

      const plan = getPlanFromHeaders(req.headers as Record<string, unknown>);
      const limits = getLimitsForPlan(plan);

      const { pdfBytes, pageCount } = await generatePdf({ title: doc.title, content: doc.content });
      if (pageCount > limits.maxPagesPerDocument) {
        return reply.status(413).send({
          code: 'LIMIT_EXCEEDED',
          message: `Document is ${pageCount} pages; limit for plan '${plan}' is ${limits.maxPagesPerDocument}.`,
          requestId: req.id,
        });
      }

      reply
        .type('application/pdf')
        .header(
          'Content-Disposition',
          `attachment; filename="${doc.title.replaceAll('"', '').replaceAll('/', '-')}.pdf"`,
        );
      return reply.send(Buffer.from(pdfBytes));
    },
  );

  done();
};
