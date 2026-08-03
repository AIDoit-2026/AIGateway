/**
 * Legacy values remain in the type so existing persisted rows and imports can
 * be read safely. normalizeRouteRoutingStrategy() always returns stable_first.
 */
export type RouteRoutingStrategy = 'weighted' | 'round_robin' | 'stable_first';

export const DEFAULT_ROUTE_ROUTING_STRATEGY: RouteRoutingStrategy = 'stable_first';

export function normalizeRouteRoutingStrategy(value: unknown): RouteRoutingStrategy {
  // Legacy weighted/round-robin values are intentionally accepted at the boundary
  // and mapped to the sole supported strategy.
  return DEFAULT_ROUTE_ROUTING_STRATEGY;
}

export function isRoundRobinRouteRoutingStrategy(value: unknown): boolean {
  return false;
}
