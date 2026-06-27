import { beforeEach, describe, expect, it, vi } from 'vitest';

const dbState = vi.hoisted(() => ({
  account: null as any,
  accountUpdateSet: null as any,
  insertedEvent: null as any,
}));

const notificationMock = vi.hoisted(() => vi.fn());
const runtimeHealthMock = vi.hoisted(() => vi.fn());

vi.mock('../db/index.js', () => {
  const schema = {
    accounts: {
      id: 'accounts.id',
      status: 'accounts.status',
    },
    events: 'events',
  };
  const db = {
    select: () => ({
      from: () => ({
        where: () => ({
          get: () => dbState.account,
        }),
      }),
    }),
    insert: () => ({
      values: (value: any) => {
        dbState.insertedEvent = value;
        return { run: () => undefined };
      },
    }),
    update: () => ({
      set: (value: any) => {
        dbState.accountUpdateSet = value;
        return {
          where: () => ({ run: () => undefined }),
        };
      },
    }),
  };
  return { db, schema };
});

vi.mock('./notifyService.js', () => ({
  sendNotification: (...args: unknown[]) => notificationMock(...args),
}));

vi.mock('./accountHealthService.js', () => ({
  setAccountRuntimeHealth: (...args: unknown[]) => runtimeHealthMock(...args),
}));

describe('reportTokenExpired', () => {
  beforeEach(() => {
    dbState.account = null;
    dbState.accountUpdateSet = null;
    dbState.insertedEvent = null;
    notificationMock.mockReset();
    runtimeHealthMock.mockReset();
  });

  it('does not mark API Key connections expired', async () => {
    const { reportTokenExpired } = await import('./alertService.js');
    dbState.account = {
      id: 1,
      apiToken: 'sk-live',
      accessToken: '',
      extraConfig: JSON.stringify({ credentialMode: 'apikey' }),
    };

    await reportTokenExpired({
      accountId: 1,
      username: 'api-key-connection',
      siteName: 'upstream',
      detail: '401 unauthorized',
    });

    expect(dbState.accountUpdateSet).toBeNull();
    expect(dbState.insertedEvent?.title).toBe('API Key 鉴权失败');
    expect(dbState.insertedEvent?.message).not.toContain('重新绑定');
    expect(runtimeHealthMock).toHaveBeenCalledWith(1, expect.objectContaining({
      reason: expect.stringContaining('API Key 鉴权失败'),
    }));
  });

  it('keeps marking Session connections expired', async () => {
    const { reportTokenExpired } = await import('./alertService.js');
    dbState.account = {
      id: 2,
      apiToken: 'sk-from-session',
      accessToken: 'session-token',
      extraConfig: JSON.stringify({ credentialMode: 'session' }),
    };

    await reportTokenExpired({
      accountId: 2,
      username: 'session-account',
      siteName: 'upstream',
      detail: 'token expired',
    });

    expect(dbState.accountUpdateSet).toMatchObject({ status: 'expired' });
    expect(dbState.insertedEvent?.title).toBe('Token 已失效');
    expect(dbState.insertedEvent?.message).toContain('重新绑定');
  });
});
