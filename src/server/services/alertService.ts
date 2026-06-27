import { db, schema } from '../db/index.js';
import { eq } from 'drizzle-orm';
import { sendNotification } from './notifyService.js';
import { setAccountRuntimeHealth } from './accountHealthService.js';
import { appendSessionTokenRebindHint } from './alertRules.js';
import { formatUtcSqlDateTime } from './localTimeService.js';
import { requiresManagedAccountTokens } from './accountExtraConfig.js';

export async function reportTokenExpired(params: {
  accountId: number;
  username?: string | null;
  siteName?: string | null;
  detail?: string;
}) {
  const account = await db
    .select()
    .from(schema.accounts)
    .where(eq(schema.accounts.id, params.accountId))
    .get();
  const shouldMarkAccountExpired = account ? requiresManagedAccountTokens(account) : true;
  const accountLabel = params.username || `ID:${params.accountId}`;
  const siteLabel = params.siteName || 'unknown-site';
  const detailText = params.detail
    ? (shouldMarkAccountExpired ? appendSessionTokenRebindHint(params.detail) : params.detail)
    : '';
  const detail = detailText ? ` (${detailText})` : '';
  const createdAt = formatUtcSqlDateTime(new Date());
  const title = shouldMarkAccountExpired ? 'Token 已失效' : 'API Key 鉴权失败';
  const message = shouldMarkAccountExpired
    ? `${accountLabel} @ ${siteLabel} 的 Token 无效或已过期${detail}`
    : `${accountLabel} @ ${siteLabel} 的 API Key 鉴权失败，请检查 Key 或上游权限${detail}`;

  await db.insert(schema.events).values({
    type: 'token',
    title,
    message,
    level: 'error',
    relatedId: params.accountId,
    relatedType: 'account',
    createdAt,
  }).run();

  if (shouldMarkAccountExpired) {
    await db.update(schema.accounts).set({
      status: 'expired',
      updatedAt: new Date().toISOString(),
    }).where(eq(schema.accounts.id, params.accountId)).run();
  }

  setAccountRuntimeHealth(params.accountId, {
    state: 'unhealthy',
    reason: shouldMarkAccountExpired
      ? (detailText ? `访问令牌失效：${detailText}` : '访问令牌失效')
      : (detailText ? `API Key 鉴权失败：${detailText}` : 'API Key 鉴权失败'),
    source: 'auth',
  });

  await sendNotification(
    title,
    message,
    'error',
  );
}

export async function reportProxyAllFailed(params: { model: string; reason: string }) {
  const createdAt = formatUtcSqlDateTime(new Date());
  await db.insert(schema.events).values({
    type: 'proxy',
    title: '代理全部失败',
    message: `模型=${params.model}, 原因=${params.reason}`,
    level: 'error',
    relatedType: 'route',
    createdAt,
  }).run();

  await sendNotification(
    '代理全部失败',
    `模型=${params.model}, 原因=${params.reason}`,
    'error',
  );
}
