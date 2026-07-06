import React, { Suspense, lazy } from 'react';
import {
  formatCompactTokens,
  formatIso,
  formatMoney,
  type OverviewResponse,
  RangeToggle,
  resolveOverviewUsageByRange,
  StatusBadge,
  TagChips,
  TrendChartFallback,
  type DownstreamKeyUsageItem,
  type Range,
} from './shared.js';

const DownstreamKeyTrendChart = lazy(() => import('../../components/charts/DownstreamKeyTrendChart.js'));
type DownstreamKeyTrendBucket = import('../../components/charts/DownstreamKeyTrendChart.js').DownstreamKeyTrendBucket;

type DownstreamKeyUsagePanelProps = {
  item: DownstreamKeyUsageItem | null;
  overview: OverviewResponse | null;
  overviewLoading: boolean;
  buckets: DownstreamKeyTrendBucket[];
  trendRange: Range;
  trendLoading: boolean;
  trendBucketSeconds: number;
  onTrendRangeChange: (range: Range) => void;
  showFixedWindowComparison?: boolean;
};

export default function DownstreamKeyUsagePanel({
  item,
  overview,
  overviewLoading,
  buckets,
  trendRange,
  trendLoading,
  trendBucketSeconds,
  onTrendRangeChange,
  showFixedWindowComparison = true,
}: DownstreamKeyUsagePanelProps) {
  const currentRangeUsage = resolveOverviewUsageByRange(overview, trendRange) || item?.rangeUsage || null;

  return (
    <>
      <div className="card" style={{ padding: 16, marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-primary)' }}>使用趋势</div>
            <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 4 }}>按选定时间窗口查看请求、Tokens 与成本变化。</div>
          </div>
          <RangeToggle range={trendRange} onChange={onTrendRangeChange} />
        </div>

        <Suspense fallback={<TrendChartFallback height={260} />}>
          <DownstreamKeyTrendChart buckets={buckets} bucketSeconds={trendBucketSeconds} loading={trendLoading} height={260} />
        </Suspense>
      </div>

      <div className="card" style={{ padding: 16, marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: 10 }}>
          基础信息
        </div>
        {overviewLoading ? (
          <div className="skeleton" style={{ width: '100%', height: 72, borderRadius: 'var(--radius-sm)' }} />
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, fontSize: 12 }}>
            <div>
              <div style={{ color: 'var(--color-text-muted)', marginBottom: 4 }}>最近使用</div>
              <div style={{ color: 'var(--color-text-primary)', fontWeight: 600 }}>{formatIso(item?.lastUsedAt)}</div>
            </div>
            <div>
              <div style={{ color: 'var(--color-text-muted)', marginBottom: 4 }}>累计请求</div>
              <div style={{ color: 'var(--color-text-primary)', fontWeight: 600 }}>{(item?.usedRequests || 0).toLocaleString()}</div>
            </div>
            <div>
              <div style={{ color: 'var(--color-text-muted)', marginBottom: 4 }}>累计成本</div>
              <div style={{ color: 'var(--color-text-primary)', fontWeight: 600 }}>{formatMoney(Number(item?.usedCost || 0))}</div>
            </div>
            <div>
              <div style={{ color: 'var(--color-text-muted)', marginBottom: 4 }}>到期时间</div>
              <div style={{ color: 'var(--color-text-primary)', fontWeight: 600 }}>{formatIso(item?.expiresAt)}</div>
            </div>
            <div>
              <div style={{ color: 'var(--color-text-muted)', marginBottom: 4 }}>主分组</div>
              <div style={{ color: 'var(--color-text-primary)', fontWeight: 600 }}>{item?.groupName || '未分组'}</div>
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <div style={{ color: 'var(--color-text-muted)', marginBottom: 6 }}>标签</div>
              <TagChips tags={item?.tags || []} accent maxVisible={6} />
            </div>
          </div>
        )}
      </div>

      <div className="card" style={{ padding: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: 10 }}>
          当前范围汇总
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, fontSize: 12 }}>
          <div>
            <div style={{ color: 'var(--color-text-muted)', marginBottom: 4 }}>Tokens</div>
            <div style={{ color: 'var(--color-text-primary)', fontWeight: 700 }}>{formatCompactTokens(currentRangeUsage?.totalTokens || 0)}</div>
          </div>
          <div>
            <div style={{ color: 'var(--color-text-muted)', marginBottom: 4 }}>请求数</div>
            <div style={{ color: 'var(--color-text-primary)', fontWeight: 700 }}>{(currentRangeUsage?.totalRequests || 0).toLocaleString()}</div>
          </div>
          <div>
            <div style={{ color: 'var(--color-text-muted)', marginBottom: 4 }}>成功率</div>
            <div style={{ color: 'var(--color-text-primary)', fontWeight: 700 }}>{currentRangeUsage?.successRate == null ? '--' : `${currentRangeUsage.successRate}%`}</div>
          </div>
          <div>
            <div style={{ color: 'var(--color-text-muted)', marginBottom: 4 }}>成本</div>
            <div style={{ color: 'var(--color-text-primary)', fontWeight: 700 }}>{formatMoney(Number(currentRangeUsage?.totalCost || 0))}</div>
          </div>
        </div>
      </div>

      {showFixedWindowComparison && overview?.usage ? (
        <div className="card" style={{ padding: 16, marginTop: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: 10 }}>
            固定窗口对比
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, fontSize: 12 }}>
            {[
              { label: '24h', data: overview.usage.last24h },
              { label: '7d', data: overview.usage.last7d },
              { label: '全部', data: overview.usage.all },
            ].map((section) => (
              <div key={section.label} style={{ border: '1px solid var(--color-border-light)', borderRadius: 'var(--radius-sm)', padding: 12 }}>
                <div style={{ color: 'var(--color-text-primary)', fontWeight: 700, marginBottom: 8 }}>{section.label}</div>
                <div style={{ color: 'var(--color-text-muted)', marginBottom: 4 }}>Tokens</div>
                <div style={{ color: 'var(--color-text-primary)', fontWeight: 700, marginBottom: 8 }}>{formatCompactTokens(section.data?.totalTokens || 0)}</div>
                <div style={{ color: 'var(--color-text-muted)', marginBottom: 4 }}>请求数</div>
                <div style={{ color: 'var(--color-text-primary)', fontWeight: 700, marginBottom: 8 }}>{(section.data?.totalRequests || 0).toLocaleString()}</div>
                <div style={{ color: 'var(--color-text-muted)', marginBottom: 4 }}>成功率</div>
                <div style={{ color: 'var(--color-text-primary)', fontWeight: 700 }}>{section.data?.successRate == null ? '--' : `${section.data.successRate}%`}</div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </>
  );
}
