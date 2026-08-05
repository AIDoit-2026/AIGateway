import Fastify, { type FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { resetRequestRateLimitStore } from '../../middleware/requestRateLimit.js';

const verifyTokenMock = vi.fn();
const getModelsMock = vi.fn();
const undiciFetchMock = vi.fn();

vi.mock('../../services/platforms/index.js', () => ({
  getAdapter: () => ({
    verifyToken: (...args: unknown[]) => verifyTokenMock(...args),
    getModels: (...args: unknown[]) => getModelsMock(...args),
  }),
}));

vi.mock('undici', () => ({
  fetch: (...args: unknown[]) => undiciFetchMock(...args),
}));

type DbModule = typeof import('../../db/index.js');

describe('accounts verify-token diagnostic matrix', { timeout: 15_000 }, () => {
  let app: FastifyInstance;
  let db: DbModule['db'];
  let schema: DbModule['schema'];
  let dataDir = '';

  beforeAll(async () => {
    dataDir = mkdtempSync(join(tmpdir(), 'metapi-accounts-verify-matrix-'));
    process.env.DATA_DIR = dataDir;

    await import('../../db/migrate.js');
    const dbModule = await import('../../db/index.js');
    const routesModule = await import('./accounts.js');
    db = dbModule.db;
    schema = dbModule.schema;

    app = Fastify();
    await app.register(routesModule.accountsRoutes);
  });

  beforeEach(async () => {
    verifyTokenMock.mockReset();
    getModelsMock.mockReset();
    undiciFetchMock.mockReset();
    resetRequestRateLimitStore();

    await db.delete(schema.proxyLogs).run();
    await db.delete(schema.checkinLogs).run();
    await db.delete(schema.routeChannels).run();
    await db.delete(schema.tokenRoutes).run();
    await db.delete(schema.tokenModelAvailability).run();
    await db.delete(schema.modelAvailability).run();
    await db.delete(schema.accountTokens).run();
    await db.delete(schema.accounts).run();
    await db.delete(schema.siteApiEndpoints).run();
    await db.delete(schema.sites).run();
  });

  afterAll(async () => {
    await app.close();
    delete process.env.DATA_DIR;
  });

  async function createSite(platform: string) {
    return db.insert(schema.sites).values({
      name: `${platform}-matrix`,
      url: `https://${platform}.example.com`,
      platform,
      status: 'active',
    }).returning().get();
  }

  it.each([
    { platform: 'new-api', userId: undefined },
    { platform: 'one-api', userId: 42 },
  ])('passes $platform session verification with platformUserId=$userId', async ({ platform, userId }) => {
    verifyTokenMock.mockResolvedValueOnce({
      tokenType: 'session',
      userInfo: { username: 'session-user' },
      balance: 1,
      apiToken: 'sk-derived',
    });
    const site = await createSite(platform);

    const response = await app.inject({
      method: 'POST',
      url: '/api/accounts/verify-token',
      payload: {
        siteId: site.id,
        accessToken: 'session-token',
        credentialMode: 'session',
        ...(userId === undefined ? {} : { platformUserId: userId }),
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ success: true, tokenType: 'session' });
    expect(verifyTokenMock).toHaveBeenCalledWith(site.url, 'session-token', userId);
    expect(getModelsMock).not.toHaveBeenCalled();
  });

  it('verifies a new-api API Key without platformUserId', async () => {
    const platform = 'new-api';
    const userId = undefined;
    const models = ['gpt-4o-mini'];
    getModelsMock.mockResolvedValueOnce(models);
    const site = await createSite(platform);

    const response = await app.inject({
      method: 'POST',
      url: '/api/accounts/verify-token',
      payload: {
        siteId: site.id,
        accessToken: 'sk-matrix',
        credentialMode: 'apikey',
        ...(userId === undefined ? {} : { platformUserId: userId }),
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      success: true,
      tokenType: 'apikey',
      modelCount: models.length,
    });
    expect(getModelsMock).toHaveBeenCalledWith(site.url, 'sk-matrix', userId);
    expect(verifyTokenMock).not.toHaveBeenCalled();
  });

  it('rejects an empty model result for a one-api API Key with platformUserId', async () => {
    const platform = 'one-api';
    const userId = 42;
    getModelsMock.mockResolvedValueOnce([]);
    const site = await createSite(platform);

    const response = await app.inject({
      method: 'POST',
      url: '/api/accounts/verify-token',
      payload: {
        siteId: site.id,
        accessToken: 'sk-empty-models',
        credentialMode: 'apikey',
        platformUserId: userId,
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ success: false });
    expect(response.json().message).toContain('未获取到可用模型');
    expect(getModelsMock).toHaveBeenCalledWith(site.url, 'sk-empty-models', userId);
    expect(verifyTokenMock).not.toHaveBeenCalled();
  });

  it.each([
    { status: 401, message: 'HTTP 401: unauthorized' },
    { status: 403, message: 'HTTP 403: forbidden' },
  ])('returns a structured failure for session upstream status $status', async ({ status, message }) => {
    verifyTokenMock.mockRejectedValueOnce(Object.assign(new Error(message), { status }));
    const site = await createSite('new-api');

    const response = await app.inject({
      method: 'POST',
      url: '/api/accounts/verify-token',
      payload: {
        siteId: site.id,
        accessToken: 'session-failure',
        credentialMode: 'session',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ success: false });
    expect(response.json().message).toContain(message);
  });

  it('keeps the HTML challenge diagnosis distinct from an empty model result', async () => {
    verifyTokenMock.mockResolvedValueOnce({ tokenType: 'unknown' });
    undiciFetchMock.mockResolvedValue({
      status: 403,
      text: async () => '<html><script>var arg1="challenge";</script></html>',
      headers: {
        get: (name: string) => name.toLowerCase() === 'content-type' ? 'text/html' : null,
      },
    });
    const site = await createSite('one-api');

    const response = await app.inject({
      method: 'POST',
      url: '/api/accounts/verify-token',
      payload: {
        siteId: site.id,
        accessToken: 'challenge-token',
        credentialMode: 'session',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ success: false, shieldBlocked: true });
    expect(response.json().modelCount).toBeUndefined();
  });
});
