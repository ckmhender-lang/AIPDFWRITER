import { type FastifyPluginAsync } from 'fastify';
import { PDFDocument } from 'pdf-lib';

import { createAsset, getAsset, getDocument, updateDocument } from '../services/storage.js';
import { encryptPdf, decryptPdf } from '../pdf/qpdf.js';
import { generatePdf } from '../pdf/generatePdf.js';

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

async function getDocumentPdfBytes(userId: string, docId: string): Promise<Uint8Array | null> {
  const doc = getDocument(userId, docId);
  if (!doc) return null;

  if (doc.generatedPdfAssetId) {
    const asset = getAsset(userId, doc.generatedPdfAssetId);
    if (!asset) return null;
    return asset.bytes;
  }

  const { pdfBytes } = await generatePdf({
    title: doc.title,
    content: doc.content,
    contentFormat: doc.contentFormat,
    templateId: doc.templateId,
    settings: doc.settings,
  });
  return pdfBytes;
}

export const pdfOpsRoutes: FastifyPluginAsync = async (app) => {
  app.post(
    '/pdf/merge',
    {
      schema: {
        description: 'Merge multiple documents PDFs into one (creates/updates a target document pdf asset)',
        body: {
          type: 'object',
          additionalProperties: false,
          required: ['documentIds', 'targetDocumentId'],
          properties: {
            documentIds: { type: 'array', items: { type: 'string' }, minItems: 2 },
            targetDocumentId: { type: 'string' },
          },
        },
        response: {
          200: { type: 'object', additionalProperties: false, required: ['assetId'], properties: { assetId: { type: 'string' } } },
          404: errorSchema,
        },
      },
    },
    async (req, reply) => {
      const userId = req.user.sub;
      const { documentIds, targetDocumentId } = req.body as {
        documentIds: string[];
        targetDocumentId: string;
      };

      const target = getDocument(userId, targetDocumentId);
      if (!target) return reply.status(404).send({ code: 'NOT_FOUND', message: 'Target not found', requestId: req.id });

      const out = await PDFDocument.create();
      for (const id of documentIds) {
        const bytes = await getDocumentPdfBytes(userId, id);
        if (!bytes) return reply.status(404).send({ code: 'NOT_FOUND', message: `Document not found: ${id}`, requestId: req.id });
        const src = await PDFDocument.load(bytes);
        const pages = await out.copyPages(src, src.getPageIndices());
        for (const p of pages) out.addPage(p);
      }

      const mergedBytes = await out.save();
      const asset = createAsset({
        ownerUserId: userId,
        kind: 'pdf',
        mimeType: 'application/pdf',
        filename: `${target.title}.pdf`,
        bytes: mergedBytes,
      });

      updateDocument(userId, targetDocumentId, { generatedPdfAssetId: asset.id } as never);

      return reply.send({ assetId: asset.id });
    },
  );

  app.post(
    '/pdf/split',
    {
      schema: {
        description: 'Split a document PDF into multiple PDF assets by page ranges',
        body: {
          type: 'object',
          additionalProperties: false,
          required: ['documentId', 'ranges'],
          properties: {
            documentId: { type: 'string' },
            ranges: {
              type: 'array',
              minItems: 1,
              items: {
                type: 'object',
                additionalProperties: false,
                required: ['start', 'end'],
                properties: {
                  start: { type: 'integer', minimum: 1 },
                  end: { type: 'integer', minimum: 1 },
                },
              },
            },
          },
        },
        response: {
          200: {
            type: 'object',
            additionalProperties: false,
            required: ['assetIds'],
            properties: { assetIds: { type: 'array', items: { type: 'string' } } },
          },
          404: errorSchema,
        },
      },
    },
    async (req, reply) => {
      const userId = req.user.sub;
      const { documentId, ranges } = req.body as {
        documentId: string;
        ranges: Array<{ start: number; end: number }>;
      };

      const doc = getDocument(userId, documentId);
      if (!doc) return reply.status(404).send({ code: 'NOT_FOUND', message: 'Not found', requestId: req.id });

      const bytes = await getDocumentPdfBytes(userId, documentId);
      if (!bytes) return reply.status(404).send({ code: 'NOT_FOUND', message: 'Not found', requestId: req.id });

      const src = await PDFDocument.load(bytes);
      const total = src.getPageCount();

      const assetIds: string[] = [];
      for (const r of ranges) {
        const start = Math.max(1, r.start);
        const end = Math.min(total, r.end);
        const idxs: number[] = [];
        for (let i = start - 1; i <= end - 1; i++) idxs.push(i);

        const out = await PDFDocument.create();
        const pages = await out.copyPages(src, idxs);
        for (const p of pages) out.addPage(p);
        const outBytes = await out.save();

        const asset = createAsset({
          ownerUserId: userId,
          kind: 'pdf',
          mimeType: 'application/pdf',
          filename: `${doc.title}-pages-${start}-${end}.pdf`,
          bytes: outBytes,
        });
        assetIds.push(asset.id);
      }

      return reply.send({ assetIds });
    },
  );

  app.post(
    '/pdf/reorder',
    {
      schema: {
        description: 'Reorder pages of a document PDF and store as generatedPdfAssetId',
        body: {
          type: 'object',
          additionalProperties: false,
          required: ['documentId', 'order'],
          properties: {
            documentId: { type: 'string' },
            order: { type: 'array', items: { type: 'integer', minimum: 1 }, minItems: 1 },
          },
        },
        response: {
          200: { type: 'object', additionalProperties: false, required: ['assetId'], properties: { assetId: { type: 'string' } } },
          404: errorSchema,
        },
      },
    },
    async (req, reply) => {
      const userId = req.user.sub;
      const { documentId, order } = req.body as { documentId: string; order: number[] };

      const doc = getDocument(userId, documentId);
      if (!doc) return reply.status(404).send({ code: 'NOT_FOUND', message: 'Not found', requestId: req.id });

      const bytes = await getDocumentPdfBytes(userId, documentId);
      if (!bytes) return reply.status(404).send({ code: 'NOT_FOUND', message: 'Not found', requestId: req.id });

      const src = await PDFDocument.load(bytes);
      const total = src.getPageCount();
      const idxs = order.map((n) => n - 1).filter((i) => i >= 0 && i < total);

      const out = await PDFDocument.create();
      const pages = await out.copyPages(src, idxs);
      for (const p of pages) out.addPage(p);
      const outBytes = await out.save();

      const asset = createAsset({
        ownerUserId: userId,
        kind: 'pdf',
        mimeType: 'application/pdf',
        filename: `${doc.title}-reordered.pdf`,
        bytes: outBytes,
      });

      updateDocument(userId, documentId, { generatedPdfAssetId: asset.id } as never);

      return reply.send({ assetId: asset.id });
    },
  );

  app.post(
    '/pdf/protect',
    {
      schema: {
        description: 'Apply password protection to a document PDF (stores new generatedPdfAssetId)',
        body: {
          type: 'object',
          additionalProperties: false,
          required: ['documentId', 'password'],
          properties: {
            documentId: { type: 'string' },
            password: { type: 'string', minLength: 1, maxLength: 200 },
          },
        },
        response: {
          200: { type: 'object', additionalProperties: false, required: ['assetId'], properties: { assetId: { type: 'string' } } },
          404: errorSchema,
        },
      },
    },
    async (req, reply) => {
      const userId = req.user.sub;
      const { documentId, password } = req.body as { documentId: string; password: string };

      const doc = getDocument(userId, documentId);
      if (!doc) return reply.status(404).send({ code: 'NOT_FOUND', message: 'Not found', requestId: req.id });

      const bytes = await getDocumentPdfBytes(userId, documentId);
      if (!bytes) return reply.status(404).send({ code: 'NOT_FOUND', message: 'Not found', requestId: req.id });

      const outBytes = await encryptPdf({ pdfBytes: bytes, userPassword: password });
      const asset = createAsset({
        ownerUserId: userId,
        kind: 'pdf',
        mimeType: 'application/pdf',
        filename: `${doc.title}-protected.pdf`,
        bytes: outBytes,
      });

      updateDocument(userId, documentId, { generatedPdfAssetId: asset.id } as never);

      return reply.send({ assetId: asset.id });
    },
  );

  app.post(
    '/pdf/unprotect',
    {
      schema: {
        description: 'Remove password protection from a document PDF (stores new generatedPdfAssetId)',
        body: {
          type: 'object',
          additionalProperties: false,
          required: ['documentId', 'password'],
          properties: {
            documentId: { type: 'string' },
            password: { type: 'string', minLength: 1, maxLength: 200 },
          },
        },
        response: {
          200: { type: 'object', additionalProperties: false, required: ['assetId'], properties: { assetId: { type: 'string' } } },
          404: errorSchema,
        },
      },
    },
    async (req, reply) => {
      const userId = req.user.sub;
      const { documentId, password } = req.body as { documentId: string; password: string };

      const doc = getDocument(userId, documentId);
      if (!doc) return reply.status(404).send({ code: 'NOT_FOUND', message: 'Not found', requestId: req.id });

      const bytes = await getDocumentPdfBytes(userId, documentId);
      if (!bytes) return reply.status(404).send({ code: 'NOT_FOUND', message: 'Not found', requestId: req.id });

      const outBytes = await decryptPdf({ pdfBytes: bytes, password });
      const asset = createAsset({
        ownerUserId: userId,
        kind: 'pdf',
        mimeType: 'application/pdf',
        filename: `${doc.title}-unprotected.pdf`,
        bytes: outBytes,
      });

      updateDocument(userId, documentId, { generatedPdfAssetId: asset.id } as never);

      return reply.send({ assetId: asset.id });
    },
  );
};
