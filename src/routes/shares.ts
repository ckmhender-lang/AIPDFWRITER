import { type FastifyPluginAsync } from 'fastify';

import { getLimitsForPlan, getPlanFromHeaders } from '../limits.js';
import { applyAnnotations } from '../pdf/annotations.js';
import { generatePdf } from '../pdf/generatePdf.js';
import { getAsset, getDocument } from '../services/storage.js';
import { createShare, getShareByToken, isShareActive, revokeShare } from '../services/shares.js';
import { trackEvent } from '../services/analytics.js';

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

export const sharesRoutes: FastifyPluginAsync = async (app) => {
  app.post(
    '/shares',
    {
      schema: {
        description: 'Create a share link for a document',
        body: {
          type: 'object',
          additionalProperties: false,
          required: ['documentId'],
          properties: {
            documentId: { type: 'string' },
            expiresInDays: { type: 'integer', minimum: 1, maximum: 3650 },
          },
        },
        response: {
          201: {
            type: 'object',
            additionalProperties: false,
            required: ['id', 'token', 'url', 'expiresAt'],
            properties: {
              id: { type: 'string' },
              token: { type: 'string' },
              url: { type: 'string' },
              expiresAt: { type: ['string', 'null'] },
            },
          },
          404: errorSchema,
        },
      },
    },
    async (req, reply) => {
      const { documentId, expiresInDays } = req.body as { documentId: string; expiresInDays?: number };

      const doc = getDocument(req.user.sub, documentId);
      if (!doc) return reply.status(404).send({ code: 'NOT_FOUND', message: 'Not found', requestId: req.id });

      const share = createShare({
        ownerUserId: req.user.sub,
        documentId,
        ...(expiresInDays !== undefined ? { expiresInDays } : {}),
      });
      trackEvent({ type: 'share.created', userId: req.user.sub, data: { documentId, shareId: share.id } });

      const baseUrl = process.env.PUBLIC_BASE_URL ?? 'http://localhost:3000';
      const url = `${baseUrl}/s/${share.token}`;

      return reply.status(201).send({ id: share.id, token: share.token, url, expiresAt: share.expiresAt });
    },
  );

  app.post(
    '/shares/:id/revoke',
    {
      schema: {
        description: 'Revoke a share link',
        params: {
          type: 'object',
          additionalProperties: false,
          required: ['id'],
          properties: { id: { type: 'string' } },
        },
        response: {
          200: { type: 'object', additionalProperties: false, required: ['ok'], properties: { ok: { type: 'boolean' } } },
          404: errorSchema,
        },
      },
    },
    async (req, reply) => {
      const { id } = req.params as { id: string };
      const ok = revokeShare(req.user.sub, id);
      if (!ok) return reply.status(404).send({ code: 'NOT_FOUND', message: 'Not found', requestId: req.id });
      trackEvent({ type: 'share.revoked', userId: req.user.sub, data: { shareId: id } });
      return reply.send({ ok: true });
    },
  );
};

export const publicShareRoutes: FastifyPluginAsync = async (app) => {
  app.get(
    '/s/:token',
    {
      schema: {
        description: 'Public share download (no auth)',
        params: {
          type: 'object',
          additionalProperties: false,
          required: ['token'],
          properties: { token: { type: 'string' } },
        },
        response: {
          200: { description: 'PDF bytes', type: 'string', format: 'binary' },
          404: errorSchema,
          410: errorSchema,
          413: errorSchema,
        },
      },
    },
    async (req, reply) => {
      const { token } = req.params as { token: string };
      const share = getShareByToken(token);
      if (!share) return reply.status(404).send({ code: 'NOT_FOUND', message: 'Not found', requestId: req.id });
      if (!isShareActive(share)) {
        return reply.status(410).send({ code: 'GONE', message: 'Share link expired or revoked', requestId: req.id });
      }

      const doc = getDocument(share.ownerUserId, share.documentId);
      if (!doc) return reply.status(404).send({ code: 'NOT_FOUND', message: 'Not found', requestId: req.id });

      const plan = getPlanFromHeaders(req.headers as Record<string, unknown>);
      const limits = getLimitsForPlan(plan);

      let pdfBytes: Uint8Array;
      if (doc.generatedPdfAssetId) {
        const asset = getAsset(share.ownerUserId, doc.generatedPdfAssetId);
        if (!asset) return reply.status(404).send({ code: 'NOT_FOUND', message: 'PDF asset missing', requestId: req.id });
        pdfBytes = asset.bytes;
      } else {
        pdfBytes = (
          await generatePdf({
            title: doc.title,
            content: doc.content,
            contentFormat: doc.contentFormat,
            templateId: doc.templateId,
            settings: doc.settings,
          })
        ).pdfBytes;
      }
      pdfBytes = await applyAnnotations(pdfBytes, doc.annotations);

      // Basic limit enforcement: use stored limit only if generated is very large
      const approxPages = Math.max(1, Math.ceil(pdfBytes.byteLength / 50_000));
      if (approxPages > limits.maxPagesPerDocument) {
        return reply.status(413).send({
          code: 'LIMIT_EXCEEDED',
          message: `Document exceeds plan '${plan}' limits.`,
          requestId: req.id,
        });
      }

      trackEvent({ type: 'share.downloaded', userId: null, data: { shareId: share.id, documentId: doc.id } });

      reply
        .type('application/pdf')
        .header('Content-Disposition', `attachment; filename="${doc.title.replaceAll('"', '').replaceAll('/', '-')}.pdf"`);
      return reply.send(Buffer.from(pdfBytes));
    },
  );
};
