import React, { useEffect, useMemo, useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { api, type DownstreamApiKeyTrendResponse } from '../api.js';
import { useToast } from '../components/Toast.js';
import DownstreamKeyUsagePanel from './downstream-keys/DownstreamKeyUsagePanel.js';
import { readClientTimeZone } from './helpers/siteAnnouncementPresentation.js';
import {
  type OverviewResponse,
  type Range,
  StatusBadge,
  TagChips,
} from './downstream-keys/shared.js';

type DownstreamKeyTrendBucket = import('../components/charts/DownstreamKeyTrendChart.js').DownstreamKeyTrendBucket;

function parsePublicUsageId(value: string | undefined): number | null {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.trunc(parsed);
}

export default function PublicDownstreamKeyUsage() {
  const toast = useToast();
  const params = useParams<{ id: string }>();
  const id = parsePublicUsageId(params.id);
  const [overview, setOverview] = useState<OverviewResponse | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(false);
  const [trendRange, setTrendRange] = useState<Range>('24h');
  const [trendLoading, setTrendLoading] = useState(false);
  const [buckets, setBuckets] = useState<DownstreamKeyTrendBucket[]>([]);
  const [trendBucketSeconds, setTrendBucketSeconds] = useState(3600);
  const [notFound, setNotFound] = useState(false);
  const viewerTimeZone = useMemo(() => readClientTimeZone(), []);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setOverview(null);
    setNotFound(false);
    setOverviewLoading(true);
    api.getPublicDownstreamApiKeyOverview(id)
      .then((res: any) => {
        if (cancelled) return;
        setOverview(res as OverviewResponse);
      })
      .catch((err: any) => {
        if (cancelled) return;
        if (String(err?.message || '').includes('404')) {
          setNotFound(true);
          return;
        }
        toast.error(err?.message || '加载公开用量失败');
      })
      .finally(() => {
        if (cancelled) return;
        setOverviewLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id, toast]);

  useEffect(() => {
    if (!id || notFound) return;
    let cancelled = false;
    const fallbackBucketSeconds = trendRange === 'all' ? 86400 : 3600;
    setBuckets([]);
    setTrendBucketSeconds(fallbackBucketSeconds);
    setTrendLoading(true);
    const trendParams = trendRange === 'all' && viewerTimeZone
      ? { range: trendRange, timeZone: viewerTimeZone }
      : { range: trendRange };
    api.getPublicDownstreamApiKeyTrend(id, trendParams)
      .then((res: DownstreamApiKeyTrendResponse) => {
        if (cancelled) return;
        setBuckets(Array.isArray(res.buckets) ? res.buckets : []);
        const nextBucketSeconds = Number(res.bucketSeconds);
        setTrendBucketSeconds(Number.isFinite(nextBucketSeconds) && nextBucketSeconds > 0 ? nextBucketSeconds : fallbackBucketSeconds);
      })
      .catch((err: any) => {
        if (cancelled) return;
        if (String(err?.message || '').includes('404')) {
          setNotFound(true);
          return;
        }
        toast.error(err?.message || '加载趋势失败');
      })
      .finally(() => {
        if (cancelled) return;
        setTrendLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id, notFound, trendRange, toast, viewerTimeZone]);

  if (!id) {
    return <Navigate to="/" replace />;
  }

  const item = overview?.item || null;

  return (
    <main style={{ minHeight: '100vh', background: 'var(--color-bg)', padding: '24px 16px 40px' }}>
      <div style={{ maxWidth: 920, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <header className="card" style={{ padding: 18 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <h1 style={{ margin: 0, fontSize: 20, lineHeight: 1.3, color: 'var(--color-text-primary)' }}>
                  {item?.name || (overviewLoading ? '加载中' : '下游密钥用量')}
                </h1>
                {item ? <StatusBadge enabled={item.enabled} /> : null}
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--color-text-muted)' }}>
                {item?.keyMasked || '****'}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                <span className={`badge ${item?.groupName ? 'badge-info' : 'badge-muted'}`} style={{ fontSize: 11 }}>
                  {item?.groupName ? `主分组 · ${item.groupName}` : '未分组'}
                </span>
                <TagChips tags={item?.tags || []} accent maxVisible={4} />
              </div>
            </div>
          </div>
        </header>

        {notFound ? (
          <div className="empty-state" style={{ padding: 40 }}>
            <div className="empty-state-title">公开用量页不存在</div>
            <div className="empty-state-desc">请确认链接中的下游密钥 ID 是否正确。</div>
          </div>
        ) : (
          <DownstreamKeyUsagePanel
            item={item}
            overview={overview}
            overviewLoading={overviewLoading}
            buckets={buckets}
            trendRange={trendRange}
            trendLoading={trendLoading}
            trendBucketSeconds={trendBucketSeconds}
            onTrendRangeChange={setTrendRange}
          />
        )}
      </div>
    </main>
  );
}
