import { describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';

describe('documents + pdf download', () => {
  it('creates a document and downloads a PDF', async () => {
    const app = await buildApp({ logger: false });

    const created = await app.inject({
      method: 'POST',
      url: '/v1/documents',
      payload: { title: 'Hello', content: 'This is a test document.' },
    });

    expect(created.statusCode).toBe(201);
    const meta = created.json() as { id: string; title: string };
    expect(meta.id).toMatch(/^doc_/);

    const download = await app.inject({
      method: 'GET',
      url: `/v1/documents/${meta.id}/download`,
    });

    expect(download.statusCode).toBe(200);
    expect(download.headers['content-type']).toContain('application/pdf');

    // Fastify inject keeps the raw bytes.
    expect(download.rawPayload.subarray(0, 4).toString('utf8')).toBe('%PDF');

    await app.close();
  });
});
