import { describe, expect, it } from 'vitest';
import {
  DEFAULT_ROUTE_ROUTING_STRATEGY,
  normalizeRouteRoutingStrategy,
} from './routeRoutingStrategy.js';

describe('route routing strategy', () => {
  it('normalizes legacy persisted strategies to stable-first', () => {
    expect(DEFAULT_ROUTE_ROUTING_STRATEGY).toBe('stable_first');
    expect(normalizeRouteRoutingStrategy('weighted')).toBe('stable_first');
    expect(normalizeRouteRoutingStrategy('round_robin')).toBe('stable_first');
    expect(normalizeRouteRoutingStrategy('stable_first')).toBe('stable_first');
  });

  it('normalizes malformed and historical variants at the boundary', () => {
    for (const value of [null, undefined, '', ' WEIGHTED ', 'ROUND_ROBIN', 'random']) {
      expect(normalizeRouteRoutingStrategy(value)).toBe('stable_first');
    }
  });
});
