export type RouteChannelRuntimeState = {
  cooldownUntil: string;
  lastFailureAt: string;
  consecutiveFailureCount: number;
  reason: string | null;
};

const runtimeStateByChannelId = new Map<number, RouteChannelRuntimeState>();
const failureCountByChannelId = new Map<number, number>();
const runtimeStateByRouteUnitMemberId = new Map<number, RouteChannelRuntimeState>();
const failureCountByRouteUnitMemberId = new Map<number, number>();

function normalizeChannelId(channelId: number): number | null {
  return Number.isInteger(channelId) && channelId > 0 ? channelId : null;
}

export function setRouteChannelRuntimeState(
  channelIds: number[],
  state: RouteChannelRuntimeState | null,
): void {
  for (const candidateId of channelIds) {
    const channelId = normalizeChannelId(candidateId);
    if (channelId == null) continue;
    if (state) runtimeStateByChannelId.set(channelId, state);
    else runtimeStateByChannelId.delete(channelId);
  }
}

export function getRouteChannelRuntimeState(
  channelId: number,
  nowMs = Date.now(),
): RouteChannelRuntimeState | null {
  const state = runtimeStateByChannelId.get(channelId);
  if (!state) return null;
  const cooldownUntilMs = Date.parse(state.cooldownUntil);
  if (!Number.isFinite(cooldownUntilMs) || cooldownUntilMs <= nowMs) {
    runtimeStateByChannelId.delete(channelId);
    return null;
  }
  return state;
}

export function clearRouteChannelRuntimeState(channelIds: number[]): void {
  setRouteChannelRuntimeState(channelIds, null);
  for (const channelId of channelIds) failureCountByChannelId.delete(channelId);
}

export function getRouteChannelRuntimeFailureCount(channelId: number): number {
  return failureCountByChannelId.get(channelId) || 0;
}

export function setRouteChannelRuntimeFailureCount(channelIds: number[], count: number): void {
  for (const channelId of channelIds) {
    if (!Number.isInteger(channelId) || channelId <= 0) continue;
    if (count > 0) failureCountByChannelId.set(channelId, count);
    else failureCountByChannelId.delete(channelId);
  }
}

export function setRouteUnitMemberRuntimeState(
  memberId: number,
  state: RouteChannelRuntimeState | null,
): void {
  if (!Number.isInteger(memberId) || memberId <= 0) return;
  if (state) runtimeStateByRouteUnitMemberId.set(memberId, state);
  else runtimeStateByRouteUnitMemberId.delete(memberId);
}

export function getRouteUnitMemberRuntimeFailureCount(memberId: number): number {
  return failureCountByRouteUnitMemberId.get(memberId) || 0;
}

export function setRouteUnitMemberRuntimeFailureCount(memberId: number, count: number): void {
  if (!Number.isInteger(memberId) || memberId <= 0) return;
  if (count > 0) failureCountByRouteUnitMemberId.set(memberId, count);
  else failureCountByRouteUnitMemberId.delete(memberId);
}

export function getRouteUnitMemberRuntimeState(
  memberId: number,
  nowMs = Date.now(),
): RouteChannelRuntimeState | null {
  const state = runtimeStateByRouteUnitMemberId.get(memberId);
  if (!state) return null;
  const cooldownUntilMs = Date.parse(state.cooldownUntil);
  if (!Number.isFinite(cooldownUntilMs) || cooldownUntilMs <= nowMs) {
    runtimeStateByRouteUnitMemberId.delete(memberId);
    return null;
  }
  return state;
}

export function clearAllRouteChannelRuntimeStateForTests(): void {
  runtimeStateByChannelId.clear();
  failureCountByChannelId.clear();
  runtimeStateByRouteUnitMemberId.clear();
  failureCountByRouteUnitMemberId.clear();
}
