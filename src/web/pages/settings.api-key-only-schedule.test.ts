import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('Settings schedule UI after API Key only simplification', () => {
  it('does not expose check-in controls', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/web/pages/Settings.tsx'), 'utf8');

    expect(source).not.toContain('triggerCheckinAll');
    expect(source).not.toContain('测试一次签到');
    expect(source).not.toContain('签到 Cron');
    expect(source).not.toContain('签到方式');
  });
});
