import { useEffect, useState } from 'react';
import { api } from '../api.js';

type Row = { siteId: number; siteName: string; model: string; period: string; total: number; success: number; availabilityPercent: number };

export default function Monitors() {
  const [days, setDays] = useState(7);
  const [kind, setKind] = useState<'hour' | 'day'>('hour');
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { setLoading(true); void api.getAvailabilityStats(days).then((data: any) => setRows(data?.[kind === 'hour' ? 'hours' : 'days'] || [])).finally(() => setLoading(false)); }, [days, kind]);
  const summary = new Map<number, Row>();
  rows.forEach((row) => { const current = summary.get(row.siteId) || { ...row, model: '全部模型', period: '', total: 0, success: 0, availabilityPercent: 0 }; current.total += row.total; current.success += row.success; current.availabilityPercent = Math.round(current.success / current.total * 1000) / 10; summary.set(row.siteId, current); });
  return <div className="animate-fade-in"><div className="page-header"><div><h2 className="page-title">可用性统计</h2><div style={{ color: 'var(--color-text-muted)' }}>按自然小时和自然日统计请求成功比例</div></div><div style={{ display: 'flex', gap: 8 }}><select value={kind} onChange={(e) => setKind(e.target.value as 'hour' | 'day')}><option value="hour">每小时</option><option value="day">每天</option></select><select value={days} onChange={(e) => setDays(Number(e.target.value))}><option value={1}>近 1 天</option><option value={7}>近 7 天</option><option value={30}>近 30 天</option><option value={90}>近 90 天</option></select></div></div>{loading ? <div className="card" style={{ padding: 24 }}>加载中…</div> : <><div className="card" style={{ padding: 16, marginBottom: 16 }}><h3>站点汇总</h3><table className="data-table"><thead><tr><th>站点</th><th>请求数</th><th>成功数</th><th>成功比例</th></tr></thead><tbody>{Array.from(summary.values()).map((row) => <tr key={row.siteId}><td>{row.siteName}</td><td>{row.total}</td><td>{row.success}</td><td>{row.availabilityPercent}%</td></tr>)}</tbody></table></div><div className="card" style={{ padding: 16 }}><h3>站点模型明细</h3><table className="data-table"><thead><tr><th>时间</th><th>站点</th><th>模型</th><th>请求数</th><th>成功比例</th></tr></thead><tbody>{rows.sort((a, b) => b.period.localeCompare(a.period)).map((row) => <tr key={`${row.siteId}-${row.model}-${row.period}`}><td>{new Date(row.period).toLocaleString()}</td><td>{row.siteName}</td><td>{row.model}</td><td>{row.total}</td><td>{row.availabilityPercent}%</td></tr>)}</tbody></table></div></>}</div>;
}
