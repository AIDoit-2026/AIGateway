import { afterEach, describe, expect, it } from 'vitest';
import { getRouteChannelAvailability } from './routeChannelAvailability.js';
import {
  clearAllRouteChannelRuntimeStateForTests,
  setRouteChannelRuntimeState,
} from './routeChannelRuntimeState.js';

describe('route channel availability', () => {
  afterEach(() => {
    clearAllRouteChannelRuntimeStateForTests();
  });

  it('keeps manual and dependency disable reasons distinct', () => {
    const availability = getRouteChannelAvailability({
      channel: { id: 11, enabled: true },
      account: { status: 'disabled' },
      site: { status: 'disabled' },
      token: { enabled: false },
    });

    expect(availability).toMatchObject({
      manualEnabled: true,
      dependencyEnabled: false,
      runtimeEnabled: true,
      effectiveEnabled: false,
      cooldownUntil: null,
    });
    expect(availability.disabledReasons).toEqual([
      '站点状态=disabled',
      'API Key/账号状态=disabled',
      '账号令牌已禁用',
    ]);
  });

  it('reports runtime cooling separately and automatically expires it', () => {
    const nowMs = Date.parse('2026-08-06T12:00:00.000Z');
    const cooldownUntil = new Date(nowMs + 60_000).toISOString();
    setRouteChannelRuntimeState([12], {
      cooldownUntil,
      lastFailureAt: new Date(nowMs).toISOString(),
      consecutiveFailureCount: 3,
      reason: 'HTTP 502',
    });

    const cooling = getRouteChannelAvailability({
      channel: { id: 12, enabled: true },
      account: { status: 'active' },
      site: { status: 'active' },
      nowMs,
    });
    expect(cooling).toMatchObject({
      dependencyEnabled: true,
      runtimeEnabled: false,
      effectiveEnabled: false,
      cooldownUntil,
      cooldownReason: 'HTTP 502',
    });

    const restored = getRouteChannelAvailability({
      channel: { id: 12, enabled: true },
      account: { status: 'active' },
      site: { status: 'active' },
      nowMs: nowMs + 60_001,
    });
    expect(restored).toMatchObject({ runtimeEnabled: true, effectiveEnabled: true, cooldownUntil: null });
  });
});
