import { type FastifyPluginAsync } from 'fastify';
import { createAsset, getAsset } from '../services/storage.js';

export const assetsRoutes: FastifyPluginAsync = async (app) => {
  app.post(
    '/assets',
    {
      schema: {
        description: 'Upload an asset (images supported; PDF supported)',
      },
    },
    async (req, reply) => {
      const userId = req.user.sub;

      const file = await req.file();
      if (!file) {
        return reply.status(400).send({ code: 'NO_FILE', message: 'No file uploaded', requestId: req.id });
      }

      const bytes = await file.toBuffer();
      const mimeType = file.mimetype;
      const filename = file.filename;

      const kind = mimeType.startsWith('image/') ? 'image' : mimeType === 'application/pdf' ? 'pdf' : 'other';

      const asset = createAsset({
        ownerUserId: userId,
        kind,
        mimeType,
        filename,
        bytes,
      });

      return reply.status(201).send({
        id: asset.id,
        kind: asset.kind,
        mimeType: asset.mimeType,
        filename: asset.filename,
        size: asset.size,
        createdAt: asset.createdAt,
      });
    },
  );

  app.get(
    '/assets/:id',
    {
      schema: {
        description: 'Download an asset',
        params: {
          type: 'object',
          additionalProperties: false,
          required: ['id'],
          properties: {
            id: { type: 'string' },
          },
        },
      },
    },
    async (req, reply) => {
      const userId = req.user.sub;
      const { id } = req.params as { id: string };

      const asset = getAsset(userId, id);
      if (!asset) {
        return reply.status(404).send({ code: 'NOT_FOUND', message: 'Not found', requestId: req.id });
      }

      reply.type(asset.mimeType);
      reply.header('Content-Disposition', `attachment; filename="${asset.filename.replaceAll('"', '')}"`);
      return reply.send(Buffer.from(asset.bytes));
    },
  );
};
