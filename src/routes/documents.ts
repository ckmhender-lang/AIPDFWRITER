import { type FastifyPluginAsync } from 'fastify';

import { getLimitsForPlan, getPlanFromHeaders } from '../limits.js';
import { generatePdf } from '../pdf/generatePdf.js';
import { applyAnnotations } from '../pdf/annotations.js';
import { PDFDocument } from 'pdf-lib';
import {
  createDocument,
  createVersion,
  getAsset,
  getDocument,
  listDocuments,
  listVersions,
  restoreDocument,
  softDeleteDocument,
  updateDocument,
} from '../services/storage.js';

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

export const documentsRoutes: FastifyPluginAsync = async (app) => {
  app.get(
    '/documents',
    {
      schema: {
        description: 'List documents (cursor omitted in MVP; user-scoped)',
        querystring: {
          type: 'object',
          additionalProperties: false,
          required: [],
          properties: {
            includeDeleted: { type: 'boolean' },
            tag: { type: 'string' },
            q: { type: 'string' },
          },
        },
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
                  required: [
                    'id',
                    'title',
                    'createdAt',
                    'updatedAt',
                    'deletedAt',
                    'tags',
                    'templateId',
                    'contentFormat',
                  ],
                  properties: {
                    id: { type: 'string' },
                    title: { type: 'string' },
                    createdAt: { type: 'string' },
                    updatedAt: { type: 'string' },
                    deletedAt: { type: ['string', 'null'] },
                    tags: { type: 'array', items: { type: 'string' } },
                    templateId: { type: ['string', 'null'] },
                    contentFormat: { type: 'string' },
                  },
                },
              },
              nextCursor: { type: ['string', 'null'] },
            },
          },
        },
      },
    },
    async (req) => {
      const q = req.query as { includeDeleted?: boolean; tag?: string; q?: string };
      const docs = listDocuments({
        ownerUserId: req.user.sub,
        ...(q.includeDeleted !== undefined ? { includeDeleted: q.includeDeleted } : {}),
        ...(q.tag !== undefined ? { tag: q.tag } : {}),
        ...(q.q !== undefined ? { q: q.q } : {}),
      });

      return {
        items: docs.map((d) => ({
          id: d.id,
          title: d.title,
          createdAt: d.createdAt,
          updatedAt: d.updatedAt,
          deletedAt: d.deletedAt,
          tags: d.tags,
          templateId: d.templateId,
          contentFormat: d.contentFormat,
        })),
        nextCursor: null,
      };
    },
  );

  app.post(
    '/documents',
    {
      schema: {
        description: 'Create a new document (title/content/format/tags/template/settings)',
        body: {
          type: 'object',
          additionalProperties: false,
          required: ['title', 'content'],
          properties: {
            title: { type: 'string', minLength: 1, maxLength: 120 },
            content: { type: 'string', minLength: 0, maxLength: 200_000 },
            contentFormat: { type: 'string', enum: ['plain', 'markdown', 'html'] },
            templateId: { type: ['string', 'null'] },
            tags: { type: 'array', items: { type: 'string', maxLength: 32 }, maxItems: 20 },
            settings: { type: 'object', additionalProperties: true },
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
    async (req, reply) => {
      const body = req.body as {
        title: string;
        content: string;
        contentFormat?: 'plain' | 'markdown' | 'html';
        templateId?: string | null;
        tags?: string[];
        settings?: Record<string, unknown>;
      };

      const doc = createDocument({
        ownerUserId: req.user.sub,
        title: body.title,
        content: body.content,
        contentFormat: body.contentFormat ?? 'plain',
        ...(body.templateId !== undefined ? { templateId: body.templateId } : {}),
        ...(body.tags !== undefined ? { tags: body.tags } : {}),
        ...(body.settings !== undefined ? { settings: body.settings } : {}),
      });

      return reply
        .status(201)
        .send({ id: doc.id, title: doc.title, createdAt: doc.createdAt, updatedAt: doc.updatedAt });
    },
  );

  app.get(
    '/documents/:id',
    {
      schema: {
        description: 'Get a document (includes content)',
        params: {
          type: 'object',
          additionalProperties: false,
          required: ['id'],
          properties: { id: { type: 'string' } },
        },
        response: {
          200: {
            type: 'object',
            additionalProperties: false,
            required: [
              'id',
              'title',
              'content',
              'contentFormat',
              'tags',
              'templateId',
              'settings',
              'annotations',
              'createdAt',
              'updatedAt',
              'deletedAt',
            ],
            properties: {
              id: { type: 'string' },
              title: { type: 'string' },
              content: { type: 'string' },
              contentFormat: { type: 'string' },
              tags: { type: 'array', items: { type: 'string' } },
              templateId: { type: ['string', 'null'] },
              settings: { type: 'object', additionalProperties: true },
              annotations: { type: 'array', items: { type: 'object', additionalProperties: true } },
              createdAt: { type: 'string' },
              updatedAt: { type: 'string' },
              deletedAt: { type: ['string', 'null'] },
            },
          },
          404: errorSchema,
        },
      },
    },
    async (req, reply) => {
      const { id } = req.params as { id: string };
      const doc = getDocument(req.user.sub, id);
      if (!doc) return reply.status(404).send({ code: 'NOT_FOUND', message: 'Not found', requestId: req.id });
      return reply.send(doc);
    },
  );

  app.put(
    '/documents/:id',
    {
      schema: {
        description: 'Update a document',
        params: {
          type: 'object',
          additionalProperties: false,
          required: ['id'],
          properties: { id: { type: 'string' } },
        },
        body: {
          type: 'object',
          additionalProperties: false,
          required: [],
          properties: {
            title: { type: 'string', minLength: 1, maxLength: 120 },
            content: { type: 'string', minLength: 0, maxLength: 200_000 },
            contentFormat: { type: 'string', enum: ['plain', 'markdown', 'html'] },
            templateId: { type: ['string', 'null'] },
            tags: { type: 'array', items: { type: 'string', maxLength: 32 }, maxItems: 20 },
            settings: { type: 'object', additionalProperties: true },
            annotations: { type: 'array', items: { type: 'object', additionalProperties: true } },
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
          404: errorSchema,
        },
      },
    },
    async (req, reply) => {
      const { id } = req.params as { id: string };
      const patch = req.body as Record<string, unknown>;

      const updated = updateDocument(req.user.sub, id, patch as never);
      if (!updated) return reply.status(404).send({ code: 'NOT_FOUND', message: 'Not found', requestId: req.id });

      return reply.send({
        id: updated.id,
        title: updated.title,
        createdAt: updated.createdAt,
        updatedAt: updated.updatedAt,
      });
    },
  );

  app.delete(
    '/documents/:id',
    {
      schema: {
        description: 'Soft-delete a document',
        params: {
          type: 'object',
          additionalProperties: false,
          required: ['id'],
          properties: { id: { type: 'string' } },
        },
        response: {
          204: { type: 'null' },
          404: errorSchema,
        },
      },
    },
    async (req, reply) => {
      const { id } = req.params as { id: string };
      const ok = softDeleteDocument(req.user.sub, id);
      if (!ok) return reply.status(404).send({ code: 'NOT_FOUND', message: 'Not found', requestId: req.id });
      return reply.status(204).send();
    },
  );

  app.post(
    '/documents/:id/restore',
    {
      schema: {
        description: 'Restore a soft-deleted document',
        params: {
          type: 'object',
          additionalProperties: false,
          required: ['id'],
          properties: { id: { type: 'string' } },
        },
        response: {
          200: {
            type: 'object',
            additionalProperties: false,
            required: ['ok'],
            properties: { ok: { type: 'boolean' } },
          },
          404: errorSchema,
        },
      },
    },
    async (req, reply) => {
      const { id } = req.params as { id: string };
      const ok = restoreDocument(req.user.sub, id);
      if (!ok) return reply.status(404).send({ code: 'NOT_FOUND', message: 'Not found', requestId: req.id });
      return reply.send({ ok: true });
    },
  );

  app.post(
    '/documents/:id/versions',
    {
      schema: {
        description: 'Create a document version snapshot',
        params: {
          type: 'object',
          additionalProperties: false,
          required: ['id'],
          properties: { id: { type: 'string' } },
        },
        response: {
          201: {
            type: 'object',
            additionalProperties: false,
            required: ['id', 'createdAt'],
            properties: {
              id: { type: 'string' },
              createdAt: { type: 'string' },
            },
          },
          404: errorSchema,
        },
      },
    },
    async (req, reply) => {
      const { id } = req.params as { id: string };
      const v = createVersion(req.user.sub, id);
      if (!v) return reply.status(404).send({ code: 'NOT_FOUND', message: 'Not found', requestId: req.id });
      return reply.status(201).send({ id: v.id, createdAt: v.createdAt });
    },
  );

  app.get(
    '/documents/:id/versions',
    {
      schema: {
        description: 'List document versions',
        params: {
          type: 'object',
          additionalProperties: false,
          required: ['id'],
          properties: { id: { type: 'string' } },
        },
        response: {
          200: {
            type: 'object',
            additionalProperties: false,
            required: ['items'],
            properties: {
              items: { type: 'array', items: { type: 'object', additionalProperties: true } },
            },
          },
          404: errorSchema,
        },
      },
    },
    async (req, reply) => {
      const { id } = req.params as { id: string };
      const versions = listVersions(req.user.sub, id);
      if (!versions) return reply.status(404).send({ code: 'NOT_FOUND', message: 'Not found', requestId: req.id });
      return reply.send({ items: versions });
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
          properties: { id: { type: 'string' } },
        },
        headers: {
          type: 'object',
          additionalProperties: true,
          properties: { 'x-plan': { type: 'string' } },
        },
        response: {
          200: { description: 'PDF bytes', type: 'string', format: 'binary' },
          404: errorSchema,
          413: errorSchema,
        },
      },
    },
    async (req, reply) => {
      const { id } = req.params as { id: string };
      const doc = getDocument(req.user.sub, id);
      if (!doc) return reply.status(404).send({ code: 'NOT_FOUND', message: 'Not found', requestId: req.id });

      const plan = getPlanFromHeaders(req.headers as Record<string, unknown>);
      const limits = getLimitsForPlan(plan);

      let pdfBytes: Uint8Array;
      if (doc.generatedPdfAssetId) {
        const asset = getAsset(req.user.sub, doc.generatedPdfAssetId);
        if (!asset) return reply.status(404).send({ code: 'NOT_FOUND', message: 'PDF asset missing', requestId: req.id });
        pdfBytes = asset.bytes;
      } else {
        const generated = await generatePdf({
          title: doc.title,
          content: doc.content,
          contentFormat: doc.contentFormat,
          templateId: doc.templateId,
          settings: doc.settings,
        });
        pdfBytes = generated.pdfBytes;
      }

      pdfBytes = await applyAnnotations(pdfBytes, doc.annotations);

      const pageCount = (await PDFDocument.load(pdfBytes)).getPageCount();
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
};
