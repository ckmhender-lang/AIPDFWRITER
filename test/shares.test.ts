import { describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';

describe('shares', () => {
  it('creates a share and downloads via public link', async () => {
    const app = await buildApp({ logger: false });

    const reg = await app.inject({
      method: 'POST',
      url: '/v1/auth/register',
      payload: { email: 's@example.com', password: 'password123' },
    });
    const { accessToken } = reg.json() as { accessToken: string };

    const created = await app.inject({
      method: 'POST',
      url: '/v1/documents',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { title: 'ShareMe', content: 'hello' },
    });
    const { id: docId } = created.json() as { id: string };

    const shareRes = await app.inject({
      method: 'POST',
      url: '/v1/shares',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { documentId: docId, expiresInDays: 1 },
    });

    expect(shareRes.statusCode).toBe(201);
    const { token } = shareRes.json() as { token: string };

    const publicDl = await app.inject({
      method: 'GET',
      url: `/s/${token}`,
    });

    expect(publicDl.statusCode).toBe(200);
    expect(publicDl.headers['content-type']).toContain('application/pdf');

    await app.close();
  });
});
