import { describe, expect, it, vi } from 'vitest';

vi.mock('../../components/BrandIcon.js', () => ({
  getBrand: () => null,
  normalizeBrandIconKey: (icon: string) => icon.trim().toLowerCase(),
}));

import {
  formatCooldownRemaining,
  ROUTE_ICON_NONE_VALUE,
  normalizeRouteDisplayIconValue,
  resolveRouteIcon,
} from './utils.js';

describe('token route cooldown helpers', () => {
  it('formats active cooldowns for route observability', () => {
    const now = Date.parse('2026-08-03T00:00:00.000Z');
    expect(formatCooldownRemaining('2026-08-03T00:02:05.000Z', now)).toBe('2m 5s');
    expect(formatCooldownRemaining('2026-08-03T00:00:00.500Z', now)).toBe('1s');
  });

  it('hides expired and invalid cooldowns', () => {
    const now = Date.parse('2026-08-03T00:00:00.000Z');
    expect(formatCooldownRemaining('2026-08-02T23:59:59.000Z', now)).toBeNull();
    expect(formatCooldownRemaining('invalid', now)).toBeNull();
  });
});

describe('token route icon helpers', () => {
  it('preserves the explicit no-icon sentinel during normalization', () => {
    expect(normalizeRouteDisplayIconValue(ROUTE_ICON_NONE_VALUE)).toBe(ROUTE_ICON_NONE_VALUE);
  });

  it('treats the explicit no-icon sentinel as no icon', () => {
    expect(resolveRouteIcon({ displayIcon: ROUTE_ICON_NONE_VALUE })).toEqual({ kind: 'none' });
  });
});
