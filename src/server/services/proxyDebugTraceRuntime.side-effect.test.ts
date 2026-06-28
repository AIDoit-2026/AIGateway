import { beforeEach, describe, expect, it, vi } from 'vitest';

const startProxyDebugTraceSessionMock = vi.fn();
const updateProxyDebugTraceSelectionMock = vi.fn();

const configMock = vi.hoisted(() => ({
  config: {
    proxyLowLatencyMode: false,
  },
}));

vi.mock('../config.js', () => configMock);

vi.mock('./proxyDebugTraceStore.js', () => ({
  startProxyDebugTraceSession: (...args: unknown[]) => startProxyDebugTraceSessionMock(...args),
  updateProxyDebugTraceSelection: (...args: unknown[]) => updateProxyDebugTraceSelectionMock(...args),
  updateProxyDebugTraceCandidates: vi.fn(),
  insertProxyDebugAttempt: vi.fn(),
  updateProxyDebugAttempt: vi.fn(),
  finalizeProxyDebugTrace: vi.fn(),
  normalizeProxyDebugResponseHeaders: () => null,
}));

describe('proxyDebugTraceRuntime side effects', () => {
  beforeEach(() => {
    startProxyDebugTraceSessionMock.mockReset();
    updateProxyDebugTraceSelectionMock.mockReset();
    configMock.config.proxyLowLatencyMode = false;
  });

  it('does not create trace sessions in low latency mode', async () => {
    configMock.config.proxyLowLatencyMode = true;
    const { startSurfaceProxyDebugTrace } = await import('./proxyDebugTraceRuntime.js');

    await expect(startSurfaceProxyDebugTrace({
      downstreamPath: '/v1/chat/completions',
      requestedModel: 'gpt-5.2',
    })).resolves.toBeNull();

    expect(startProxyDebugTraceSessionMock).not.toHaveBeenCalled();
  });

  it('does not wait for safe trace updates', async () => {
    updateProxyDebugTraceSelectionMock.mockImplementation(() => new Promise(() => {}));
    const { safeUpdateSurfaceProxyDebugSelection } = await import('./proxyDebugTraceRuntime.js');

    await expect(safeUpdateSurfaceProxyDebugSelection({
      traceId: 123,
      options: {
        enabled: true,
        captureHeaders: true,
        captureBodies: true,
        captureStreamChunks: false,
        targetSessionId: '',
        targetClientKind: '',
        targetModel: '',
        retentionHours: 24,
        maxBodyBytes: 262_144,
      },
    }, {
      selectedChannelId: 11,
      selectedAccountId: 22,
      selectedSiteId: 33,
      selectedRouteId: 44,
      stickySessionKey: null,
    })).resolves.toBeUndefined();

    await Promise.resolve();
    expect(updateProxyDebugTraceSelectionMock).toHaveBeenCalledWith(123, expect.objectContaining({
      selectedChannelId: 11,
    }));
  });
});
