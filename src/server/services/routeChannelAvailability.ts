import { getRouteChannelRuntimeState } from './routeChannelRuntimeState.js';

type RouteChannelLike = { id: number; enabled?: boolean | null };
type AccountLike = { status?: string | null };
type SiteLike = { status?: string | null };
type TokenLike = { enabled?: boolean | null } | null | undefined;

export type RouteChannelAvailability = {
  manualEnabled: boolean;
  dependencyEnabled: boolean;
  runtimeEnabled: boolean;
  effectiveEnabled: boolean;
  disabledReasons: string[];
  cooldownUntil: string | null;
  cooldownReason: string | null;
  consecutiveFailCount: number;
  lastFailAt: string | null;
};

export function getRouteChannelAvailability(input: {
  channel: RouteChannelLike;
  account: AccountLike;
  site: SiteLike;
  token?: TokenLike;
  nowMs?: number;
}): RouteChannelAvailability {
  const disabledReasons: string[] = [];
  const manualEnabled = input.channel.enabled !== false;
  if (!manualEnabled) disabledReasons.push('通道已手动禁用');

  if ((input.site.status || 'active') !== 'active') {
    disabledReasons.push(`站点状态=${input.site.status || 'disabled'}`);
  }
  if ((input.account.status || 'active') !== 'active') {
    disabledReasons.push(`API Key/账号状态=${input.account.status || 'disabled'}`);
  }
  if (input.token && input.token.enabled === false) {
    disabledReasons.push('账号令牌已禁用');
  }

  const runtimeState = getRouteChannelRuntimeState(input.channel.id, input.nowMs);
  if (runtimeState) disabledReasons.push('动态冷却中');

  const dependencyEnabled = !disabledReasons.some((reason) => (
    reason.startsWith('站点状态=')
    || reason.startsWith('API Key/账号状态=')
    || reason === '账号令牌已禁用'
  ));
  const runtimeEnabled = !runtimeState;
  return {
    manualEnabled,
    dependencyEnabled,
    runtimeEnabled,
    effectiveEnabled: manualEnabled && dependencyEnabled && runtimeEnabled,
    disabledReasons,
    cooldownUntil: runtimeState?.cooldownUntil || null,
    cooldownReason: runtimeState?.reason || null,
    consecutiveFailCount: runtimeState?.consecutiveFailureCount || 0,
    lastFailAt: runtimeState?.lastFailureAt || null,
  };
}
