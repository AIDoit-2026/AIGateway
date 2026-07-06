import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, create, type ReactTestInstance } from 'react-test-renderer';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ToastProvider } from '../components/Toast.js';
import PublicDownstreamKeyUsage from './PublicDownstreamKeyUsage.js';

const { apiMock } = vi.hoisted(() => ({
  apiMock: {
    getPublicDownstreamApiKeyOverview: vi.fn(),
    getPublicDownstreamApiKeyTrend: vi.fn(),
  },
}));

vi.mock('../api.js', () => ({ api: apiMock }));

vi.mock('../components/charts/DownstreamKeyTrendChart.js', () => ({
  default: ({ buckets }: { buckets: Array<{ totalTokens: number }> }) => (
    <div data-testid="downstream-trend-chart">{`trend:${buckets.length}`}</div>
  ),
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
    await Promise.resolve();
  });
}

function renderPublicPage() {
  return create(
    <MemoryRouter initialEntries={['/public/downstream-keys/7/usage']}>
      <ToastProvider>
        <Routes>
          <Route path="/public/downstream-keys/:id/usage" element={<PublicDownstreamKeyUsage />} />
        </Routes>
      </ToastProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  apiMock.getPublicDownstreamApiKeyOverview.mockResolvedValue({
    success: true,
    item: {
      id: 7,
      name: 'public-key',
      keyMasked: 'sk-p****0007',
      enabled: true,
      description: 'public usage',
      groupName: '公开组',
      tags: ['外部', '统计'],
      expiresAt: null,
      usedCost: 1.23,
      usedRequests: 42,
      lastUsedAt: '2026-03-15T08:27:25.378Z',
      createdAt: '2026-03-15T08:27:25.378Z',
    },
    usage: {
      last24h: { totalRequests: 2, successRequests: 2, failedRequests: 0, successRate: 100, totalTokens: 1200, totalCost: 0.12 },
      last7d: { totalRequests: 4, successRequests: 3, failedRequests: 1, successRate: 75, totalTokens: 5400, totalCost: 0.54 },
      all: { totalRequests: 42, successRequests: 40, failedRequests: 2, successRate: 95.2, totalTokens: 9900, totalCost: 1.23 },
    },
  });
  apiMock.getPublicDownstreamApiKeyTrend.mockResolvedValue({
    success: true,
    range: '24h',
    item: { id: 7, name: 'public-key' },
    bucketSeconds: 3600,
    buckets: [
      { startUtc: '2026-03-15T08:00:00.000Z', totalRequests: 2, successRequests: 2, failedRequests: 0, successRate: 100, totalTokens: 1200, totalCost: 0.12 },
    ],
  });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('PublicDownstreamKeyUsage page', () => {
  it('loads public usage data without authenticated API calls', async () => {
    let root!: WebTestRenderer;
    try {
      await act(async () => {
        root = renderPublicPage();
      });
      await flushMicrotasks();

      expect(apiMock.getPublicDownstreamApiKeyOverview).toHaveBeenCalledWith(7);
      expect(apiMock.getPublicDownstreamApiKeyTrend).toHaveBeenCalledWith(7, { range: '24h' });

      const text = collectText(root!.root);
      expect(text).toContain('public-key');
      expect(text).toContain('sk-p****0007');
      expect(text).toContain('使用趋势');
      expect(text).toContain('基础信息');
      expect(text).toContain('当前范围汇总');
      expect(text).toContain('固定窗口对比');
      expect(text).toContain('公开组');
      expect(text).toContain('1.2K');
    } finally {
      root?.unmount();
    }
  });

  it('reloads public trend when the range changes', async () => {
    let root!: WebTestRenderer;
    try {
      await act(async () => {
        root = renderPublicPage();
      });
      await flushMicrotasks();

      const range7d = root!.root.findAll((node) => node.type === 'button' && collectText(node) === '7d')[0];
      await act(async () => {
        range7d.props.onClick();
      });
      await flushMicrotasks();

      expect(apiMock.getPublicDownstreamApiKeyTrend).toHaveBeenCalledWith(7, { range: '7d' });
    } finally {
      root?.unmount();
    }
  });
});
