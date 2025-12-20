import { describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';

describe('pdf ops', () => {
  it('protects and unprotects a document pdf', async () => {
    const app = await buildApp({ logger: false });

    const reg = await app.inject({
      method: 'POST',
      url: '/v1/auth/register',
      payload: { email: 'p@example.com', password: 'password123' },
    });
    const { accessToken } = reg.json() as { accessToken: string };

    const created = await app.inject({
      method: 'POST',
      url: '/v1/documents',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { title: 'Sec', content: 'secret content' },
    });
    const { id } = created.json() as { id: string };

    const protect = await app.inject({
      method: 'POST',
      url: '/v1/pdf/protect',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { documentId: id, password: 'pw' },
    });
    expect(protect.statusCode).toBe(200);

    const unprotect = await app.inject({
      method: 'POST',
      url: '/v1/pdf/unprotect',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { documentId: id, password: 'pw' },
    });
    expect(unprotect.statusCode).toBe(200);

    await app.close();
  });
});
