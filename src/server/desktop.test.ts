import Fastify from 'fastify';
import { describe, expect, it } from 'vitest';
import { isPublicApiRoute, registerDesktopRoutes } from './desktop.js';

describe('desktop server routes', () => {
  it('marks only explicit public routes as public', () => {
    expect(isPublicApiRoute('/api/desktop/health')).toBe(true);
    expect(isPublicApiRoute('/api/public/downstream-keys/1/overview')).toBe(true);
    expect(isPublicApiRoute('/api/public/downstream-keys/1/trend?range=24h')).toBe(true);
    expect(isPublicApiRoute('/api/downstream-keys/1/overview')).toBe(false);
    expect(isPublicApiRoute('/api/stats/dashboard')).toBe(false);
  });

  it('registers a public desktop health probe', async () => {
    const app = Fastify();
    await registerDesktopRoutes(app);

    const response = await app.inject({
      method: 'GET',
      url: '/api/desktop/health',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ ok: true });
    await app.close();
  });
});
