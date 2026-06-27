import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function readAccountsSource() {
  return readFileSync(resolve(process.cwd(), 'src/web/pages/Accounts.tsx'), 'utf8');
}

describe('Accounts API Key only page', () => {
  it('keeps the page scoped to API Key connections', () => {
    const source = readAccountsSource();

    expect(source).toContain('credentialMode: "apikey"');
    expect(source).toContain('API Key 连接');
    expect(source).toContain('parseBatchApiKeys');
    expect(source).not.toContain('TokensPanel');
    expect(source).not.toContain('loginAccount');
    expect(source).not.toContain('rebindAccountSession');
    expect(source).not.toContain('triggerCheckin');
    expect(source).not.toContain('refreshBalance');
    expect(source).not.toContain('Session Token');
  });
});
