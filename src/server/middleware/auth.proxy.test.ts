import Fastify from 'fastify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const authorizeDownstreamTokenMock = vi.fn();
const consumeManagedKeyRequestMock = vi.fn();
const configMock = vi.hoisted(() => ({
  config: {
    proxyLowLatencyMode: false,
    adminIpAllowlist: [],
    authToken: 'admin-token',
  },
}));

vi.mock('../services/downstreamApiKeyService.js', () => ({
  authorizeDownstreamToken: (...args: unknown[]) => authorizeDownstreamTokenMock(...args),
  consumeManagedKeyRequest: (...args: unknown[]) => consumeManagedKeyRequestMock(...args),
}));

vi.mock('../config.js', () => configMock);

describe('proxyAuthMiddleware', () => {
  beforeEach(() => {
    authorizeDownstreamTokenMock.mockReset();
    consumeManagedKeyRequestMock.mockReset();
    configMock.config.proxyLowLatencyMode = false;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('rejects missing proxy credentials', async () => {
    const { proxyAuthMiddleware } = await import('./auth.js');
    const app = Fastify();
    app.addHook('onRequest', proxyAuthMiddleware);
    app.get('/v1/ping', async () => ({ ok: true }));

    const res = await app.inject({ method: 'GET', url: '/v1/ping' });
    expect(res.statusCode).toBe(401);
    expect(res.json()).toMatchObject({ error: expect.stringContaining('Missing Authorization') });
    await app.close();
  });

  it('stores managed key context and consumes request usage', async () => {
    authorizeDownstreamTokenMock.mockResolvedValue({
      ok: true,
      source: 'managed',
      token: 'sk-managed-001',
      key: { id: 12, name: 'project-key' },
      policy: { supportedModels: ['gpt-5.2'], allowedRouteIds: [3], siteWeightMultipliers: { 1: 1.2 } },
    });
    consumeManagedKeyRequestMock.mockResolvedValue(undefined);

    const { proxyAuthMiddleware, getProxyAuthContext, getProxyResourceOwner } = await import('./auth.js');
    const app = Fastify();
    app.addHook('onRequest', proxyAuthMiddleware);
    app.get('/v1/ping', async (request) => ({
      auth: getProxyAuthContext(request),
      owner: getProxyResourceOwner(request),
    }));

    const res = await app.inject({
      method: 'GET',
      url: '/v1/ping',
      headers: { Authorization: 'Bearer sk-managed-001' },
    });

    expect(res.statusCode).toBe(200);
    expect(authorizeDownstreamTokenMock).toHaveBeenCalledWith('sk-managed-001');
    expect(consumeManagedKeyRequestMock).toHaveBeenCalledWith(12);
    expect(res.json()).toMatchObject({
      auth: {
        source: 'managed',
        keyId: 12,
        keyName: 'project-key',
        policy: {
          supportedModels: ['gpt-5.2'],
          allowedRouteIds: [3],
          siteWeightMultipliers: { 1: 1.2 },
        },
      },
      owner: {
        ownerType: 'managed_key',
        ownerId: '12',
      },
    });
    await app.close();
  });

  it('does not block managed key authentication on slow request usage writes', async () => {
    authorizeDownstreamTokenMock.mockResolvedValue({
      ok: true,
      source: 'managed',
      token: 'sk-managed-001',
      key: { id: 12, name: 'project-key' },
      policy: null,
    });
    consumeManagedKeyRequestMock.mockImplementation(() => new Promise(() => {}));

    const { proxyAuthMiddleware, getProxyAuthContext } = await import('./auth.js');
    const app = Fastify();
    app.addHook('onRequest', proxyAuthMiddleware);
    app.get('/v1/ping', async (request) => ({
      auth: getProxyAuthContext(request),
    }));

    const res = await app.inject({
      method: 'GET',
      url: '/v1/ping',
      headers: { Authorization: 'Bearer sk-managed-001' },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      auth: {
        source: 'managed',
        keyId: 12,
      },
    });
    await Promise.resolve();
    expect(consumeManagedKeyRequestMock).toHaveBeenCalledWith(12);
    await app.close();
  });

  it('skips managed key request usage in low latency mode', async () => {
    configMock.config.proxyLowLatencyMode = true;
    authorizeDownstreamTokenMock.mockResolvedValue({
      ok: true,
      source: 'managed',
      token: 'sk-managed-001',
      key: { id: 12, name: 'project-key' },
      policy: null,
    });

    const { proxyAuthMiddleware, getProxyAuthContext } = await import('./auth.js');
    const app = Fastify();
    app.addHook('onRequest', proxyAuthMiddleware);
    app.get('/v1/ping', async (request) => ({
      auth: getProxyAuthContext(request),
    }));

    const res = await app.inject({
      method: 'GET',
      url: '/v1/ping',
      headers: { Authorization: 'Bearer sk-managed-001' },
    });

    expect(res.statusCode).toBe(200);
    expect(consumeManagedKeyRequestMock).not.toHaveBeenCalled();
    expect(res.json()).toMatchObject({
      auth: {
        source: 'managed',
        keyId: 12,
        keyName: 'project-key',
      },
    });
    await app.close();
  });
});
