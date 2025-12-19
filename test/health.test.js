import { describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
describe('GET /health', () => {
    it('returns ok=true', async () => {
        const app = await buildApp({ logger: false });
        const res = await app.inject({ method: 'GET', url: '/health' });
        expect(res.statusCode).toBe(200);
        expect(res.json()).toEqual({ ok: true });
        await app.close();
    });
});
//# sourceMappingURL=health.test.js.map