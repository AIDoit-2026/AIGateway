import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, create, type ReactTestInstance } from 'react-test-renderer';
import { MemoryRouter } from 'react-router-dom';
import { ToastProvider } from '../components/Toast.js';
import TokenRoutes from './TokenRoutes.js';

const { apiMock, getBrandMock } = vi.hoisted(() => ({
  apiMock: {
    getRoutesSummary: vi.fn(),
    getRouteChannels: vi.fn(),
    getModelTokenCandidates: vi.fn(),
    getRouteDecisionsBatch: vi.fn(),
    getRouteWideDecisionsBatch: vi.fn(),
    updateRoute: vi.fn(),
  },
  getBrandMock: vi.fn(),
}));

vi.mock('../api.js', () => ({
  api: apiMock,
}));

vi.mock('../components/BrandIcon.js', () => ({
  BrandGlyph: ({ brand, icon, model }: { brand?: { name?: string } | null; icon?: string | null; model?: string | null }) => (
    <span>{brand?.name || icon || model || ''}</span>
  ),
  InlineBrandIcon: ({ model }: { model: string }) => model ? <span>{model}</span> : null,
  getBrand: (...args: unknown[]) => getBrandMock(...args),
  hashColor: () => 'linear-gradient(135deg,#4f46e5,#818cf8)',
  normalizeBrandIconKey: (icon: string) => icon,
}));

function collectText(node: ReactTestInstance): string {
  return (node.children || []).map((child) => {
    if (typeof child === 'string') return child;
    return collectText(child);
  }).join('');
}

async function flushMicrotasks() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe('TokenRoutes routing strategy updates', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getBrandMock.mockReset();
    getBrandMock.mockReturnValue(null);
    apiMock.getRoutesSummary
      .mockResolvedValue([
        {
          id: 1,
          modelPattern: 'gpt-4o-mini',
          displayName: 'gpt-4o-mini',
          displayIcon: null,
          modelMapping: null,
          routingStrategy: 'weighted',
          enabled: true,
          channelCount: 0,
          enabledChannelCount: 0,
          siteNames: [],
          decisionSnapshot: null,
          decisionRefreshedAt: null,
        },
      ]);
    apiMock.getRouteChannels.mockResolvedValue([]);
    apiMock.getModelTokenCandidates.mockResolvedValue({ models: {} });
    apiMock.getRouteDecisionsBatch.mockResolvedValue({ decisions: {} });
    apiMock.getRouteWideDecisionsBatch.mockResolvedValue({ decisions: {} });
    apiMock.updateRoute.mockResolvedValue({});
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders stable-first for legacy routes without offering a strategy selector', async () => {
    let root!: WebTestRenderer;
    try {
      await act(async () => {
        root = create(
          <MemoryRouter initialEntries={['/routes']}>
            <ToastProvider>
              <TokenRoutes />
            </ToastProvider>
          </MemoryRouter>,
        );
      });
      await flushMicrotasks();

      const expandButton = root.root.find((node) => (
        node.type === 'div'
        && String(node.props.className || '').includes('route-card-collapsed')
      ));
      await act(async () => {
        expandButton.props.onClick();
      });
      await flushMicrotasks();

      const fixedStrategy = root.root.find((node) => (
        node.type === 'div'
        && collectText(node).trim() === '稳定优先'
      ));
      expect(collectText(fixedStrategy)).toBe('稳定优先');
      expect(apiMock.updateRoute).not.toHaveBeenCalled();
    } finally {
      root?.unmount();
    }
  });

});
