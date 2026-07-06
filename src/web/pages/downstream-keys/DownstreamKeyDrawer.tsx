import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { api, type DownstreamApiKeyTrendResponse } from '../../api.js';
import { useToast } from '../../components/Toast.js';
import { useAnimatedVisibility } from '../../components/useAnimatedVisibility.js';
import { readClientTimeZone } from '../helpers/siteAnnouncementPresentation.js';
import {
  type OverviewResponse,
  StatusBadge,
  TagChips,
  type Range,
  type SummaryItem,
} from './shared.js';
import DownstreamKeyUsagePanel from './DownstreamKeyUsagePanel.js';

type DownstreamKeyTrendBucket = import('../../components/charts/DownstreamKeyTrendChart.js').DownstreamKeyTrendBucket;

type DownstreamKeyDrawerProps = {
  open: boolean;
  onClose: () => void;
  item: SummaryItem | null;
  initialRange: Range;
};

export default function DownstreamKeyDrawer({
  open,
  onClose,
  item,
  initialRange,
}: DownstreamKeyDrawerProps) {
  const toast = useToast();
  const presence = useAnimatedVisibility(open, 220);
  const [overview, setOverview] = useState<OverviewResponse | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(false);
  const [trendRange, setTrendRange] = useState<Range>(initialRange);
  const [trendLoading, setTrendLoading] = useState(false);
  const [buckets, setBuckets] = useState<DownstreamKeyTrendBucket[]>([]);
  const [trendBucketSeconds, setTrendBucketSeconds] = useState<number>(initialRange === 'all' ? 86400 : 3600);
  const viewerTimeZone = useMemo(() => readClientTimeZone(), []);

  useEffect(() => {
    if (!open) return;
    setTrendRange(initialRange);
    setTrendBucketSeconds(initialRange === 'all' ? 86400 : 3600);
  }, [open, initialRange]);

  useEffect(() => {
    if (!open || !item?.id) return;
    let cancelled = false;
    setOverview(null);
    setOverviewLoading(true);
    api.getDownstreamApiKeyOverview(item.id)
      .then((res: any) => {
        if (cancelled) return;
        setOverview(res as OverviewResponse);
      })
      .catch((err: any) => {
        if (cancelled) return;
        toast.error(err?.message || '加载 Key 概览失败');
      })
      .finally(() => {
        if (cancelled) return;
        setOverviewLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, item?.id, toast]);

  useEffect(() => {
    if (!open || !item?.id) return;
    let cancelled = false;
    const fallbackBucketSeconds = trendRange === 'all' ? 86400 : 3600;
    setBuckets([]);
    setTrendBucketSeconds(fallbackBucketSeconds);
    setTrendLoading(true);
    const trendParams = trendRange === 'all' && viewerTimeZone
      ? { range: trendRange, timeZone: viewerTimeZone }
      : { range: trendRange };
    api.getDownstreamApiKeyTrend(item.id, trendParams)
      .then((res: DownstreamApiKeyTrendResponse) => {
        if (cancelled) return;
        setBuckets(Array.isArray(res.buckets) ? res.buckets : []);
        const nextBucketSeconds = Number(res.bucketSeconds);
        setTrendBucketSeconds(Number.isFinite(nextBucketSeconds) && nextBucketSeconds > 0 ? nextBucketSeconds : fallbackBucketSeconds);
      })
      .catch((err: any) => {
        if (cancelled) return;
        toast.error(err?.message || '加载趋势失败');
      })
      .finally(() => {
        if (cancelled) return;
        setTrendLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, item?.id, trendRange, toast, viewerTimeZone]);

  if (!presence.shouldRender) return null;

  const panel = (
    <div
      className={`modal-backdrop ${presence.isVisible ? '' : 'is-closing'}`.trim()}
      onClick={onClose}
      style={{ justifyContent: 'flex-end', alignItems: 'stretch', padding: 0 }}
    >
      <div
        className={`modal-content ${presence.isVisible ? '' : 'is-closing'}`.trim()}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'min(92vw, 560px)',
          maxWidth: 560,
          height: '100vh',
          maxHeight: '100vh',
          borderRadius: 0,
          animation: presence.isVisible ? 'drawer-slide-in 0.3s cubic-bezier(0.22, 1, 0.36, 1) both' : 'drawer-slide-out 0.22s cubic-bezier(0.4, 0, 1, 1) both',
        }}
      >
        <div className="modal-header" style={{ paddingTop: 18, paddingBottom: 12, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span>{item?.name || '--'}</span>
              <StatusBadge enabled={!!item?.enabled} />
            </div>
            <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
              {item?.keyMasked || '****'}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 6 }}>
              <span className={`badge ${item?.groupName ? 'badge-info' : 'badge-muted'}`} style={{ fontSize: 11 }}>
                {item?.groupName ? `主分组 · ${item.groupName}` : '未分组'}
              </span>
              <TagChips tags={item?.tags || []} accent maxVisible={4} />
            </div>
          </div>
          <button className="btn btn-ghost" onClick={onClose} style={{ border: '1px solid var(--color-border)' }}>
            关闭
          </button>
        </div>

        <div className="modal-body" style={{ paddingTop: 0 }}>
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
        </div>
      </div>
    </div>
  );

  return createPortal(panel, document.body);
}
