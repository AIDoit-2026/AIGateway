import { beforeEach, describe, expect, it, vi } from 'vitest';

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
  beforeEach(async () => {
    selectChannelMock.mockReset();
    selectNextChannelMock.mockReset();
    selectPreferredChannelMock.mockReset();
    refreshModelsAndRebuildRoutesMock.mockReset();
    const { resetLowLatencyRouteRefreshStateForTests } = await import('./channelSelection.js');
    resetLowLatencyRouteRefreshStateForTests();
  });

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

  it('deduplicates in-flight low latency route refreshes', async () => {
    selectChannelMock.mockResolvedValue(null);
    refreshModelsAndRebuildRoutesMock.mockImplementation(() => new Promise(() => {}));

    const { selectProxyChannelForAttempt } = await import('./channelSelection.js');

    await selectProxyChannelForAttempt({
      requestedModel: 'gpt-5.2',
      downstreamPolicy: {},
      excludeChannelIds: [],
      retryCount: 0,
    });
    await Promise.resolve();
    await selectProxyChannelForAttempt({
      requestedModel: 'gpt-5.2',
      downstreamPolicy: {},
      excludeChannelIds: [],
      retryCount: 0,
    });
    await Promise.resolve();

    expect(refreshModelsAndRebuildRoutesMock).toHaveBeenCalledTimes(1);
    expect(selectChannelMock).toHaveBeenCalledTimes(2);
  });

  it('throttles completed low latency route refreshes', async () => {
    const nowSpy = vi.spyOn(Date, 'now');
    nowSpy.mockReturnValue(100_000);
    selectChannelMock.mockResolvedValue(null);
    refreshModelsAndRebuildRoutesMock.mockResolvedValue(undefined);

    const { selectProxyChannelForAttempt } = await import('./channelSelection.js');

    await selectProxyChannelForAttempt({
      requestedModel: 'gpt-5.2',
      downstreamPolicy: {},
      excludeChannelIds: [],
      retryCount: 0,
    });
    await Promise.resolve();
    await Promise.resolve();

    nowSpy.mockReturnValue(105_000);
    await selectProxyChannelForAttempt({
      requestedModel: 'gpt-5.2',
      downstreamPolicy: {},
      excludeChannelIds: [],
      retryCount: 0,
    });
    await Promise.resolve();

    expect(refreshModelsAndRebuildRoutesMock).toHaveBeenCalledTimes(1);
    nowSpy.mockRestore();
  });
});
