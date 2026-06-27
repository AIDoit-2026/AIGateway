import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('App sidebar config', () => {
  it('uses API Key 连接 for /accounts and removes legacy standalone navigation items', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/web/App.tsx'), 'utf8');

    expect(source).toContain("{ to: '/accounts', label: 'API Key 连接'");
    expect(source).not.toContain("{ to: '/accounts', label: '账号'");
    expect(source).not.toContain("{ to: '/tokens', label: '令牌管理'");
    expect(source).not.toContain("{ to: '/oauth', label: 'OAuth 管理'");
    expect(source).not.toContain("{ to: '/checkin', label: '签到记录'");
  });

  it('places downstream key navigation under 控制台 instead of 系统', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/web/App.tsx'), 'utf8');
    const consoleGroupIndex = source.indexOf("label: '控制台'");
    const downstreamIndex = source.indexOf("{ to: '/downstream-keys', label: '下游密钥'");
    const systemGroupIndex = source.indexOf("label: '系统'");

    expect(consoleGroupIndex).toBeGreaterThanOrEqual(0);
    expect(downstreamIndex).toBeGreaterThan(consoleGroupIndex);
    expect(systemGroupIndex).toBeGreaterThan(downstreamIndex);
  });

  it('keeps legacy OAuth, checkin, and token routes as redirects only', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/web/App.tsx'), 'utf8');

    expect(source).not.toContain("const OAuthManagement = lazy(() => import('./pages/OAuthManagement.js'));");
    expect(source).not.toContain("const Tokens = lazy(() => import('./pages/Tokens.js'));");
    expect(source).not.toContain("const CheckinLog = lazy(() => import('./pages/CheckinLog.js'));");
    expect(source).toContain('<Route path="/oauth" element={<Navigate to="/accounts?segment=apikey" replace />} />');
    expect(source).toContain('<Route path="/checkin" element={<Navigate to="/accounts?segment=apikey" replace />} />');
    expect(source).toContain('<Route path="/tokens" element={<Navigate to="/accounts?segment=apikey" replace />} />');
  });
});
