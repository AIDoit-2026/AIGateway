import { describe, expect, it, vi } from 'vitest';

const selectChannelMock = vi.fn();
const selectNextChannelMock = vi.fn();
const selectPreferredChannelMock = vi.fn();
const refreshModelsAndRebuildRoutesMock = vi.fn();

vi.mock('../config.js', () => ({
  config: {
    proxyLowLatencyMode: true,
  },
}));

vi.mock('../services/tokenRouter.js', () => ({
  tokenRouter: {
    selectChannel: (...args: unknown[]) => selectChannelMock(...args),
    selectNextChannel: (...args: unknown[]) => selectNextChannelMock(...args),
    selectPreferredChannel: (...args: unknown[]) => selectPreferredChannelMock(...args),
  },
}));

vi.mock('../services/routeRefreshWorkflow.js', () => ({
  refreshModelsAndRebuildRoutes: (...args: unknown[]) => refreshModelsAndRebuildRoutesMock(...args),
}));

describe('selectProxyChannelForAttempt low latency mode', () => {
  it('does not wait for route refresh when no channel is available', async () => {
    selectChannelMock.mockResolvedValue(null);
    refreshModelsAndRebuildRoutesMock.mockImplementation(() => new Promise(() => {}));

    const { selectProxyChannelForAttempt } = await import('./channelSelection.js');

    await expect(selectProxyChannelForAttempt({
      requestedModel: 'gpt-5.2',
      downstreamPolicy: {},
      excludeChannelIds: [],
      retryCount: 0,
    })).resolves.toBeNull();

    await Promise.resolve();
    expect(refreshModelsAndRebuildRoutesMock).toHaveBeenCalledTimes(1);
    expect(selectChannelMock).toHaveBeenCalledTimes(1);
  });
});
