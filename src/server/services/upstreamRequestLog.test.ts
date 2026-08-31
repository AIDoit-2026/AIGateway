import { describe, expect, it } from 'vitest';
import { summarizeFailedUpstreamRequest } from './upstreamRequestLog.js';

describe('summarizeFailedUpstreamRequest', () => {
  it('redacts credentials and truncates failed outbound request bodies', () => {
    const summary = summarizeFailedUpstreamRequest({
      url: 'https://upstream.example/v1/models?api_key=secret-query&safe=value',
      method: 'POST',
      headers: {
        Authorization: 'Bearer secret-token',
        Cookie: 'session=secret-cookie',
        'X-Trace': 'trace-123',
      },
      body: JSON.stringify({ token: 'body-secret', prompt: 'x'.repeat(2_100) }),
      error: new Error('network timeout'),
      durationMs: 321,
    });

    expect(summary.url).toBe('https://upstream.example/v1/models?api_key=%5BREDACTED%5D&safe=value');
    expect(summary.headers).toEqual({
      authorization: '[REDACTED]',
      cookie: '[REDACTED]',
      'x-trace': 'trace-123',
    });
    expect(summary.body).toContain('"token":"[REDACTED]"');
    expect(summary.body).toHaveLength(2_048);
    expect(summary.errorCategory).toBe('timeout');
    expect(summary.durationMs).toBe(321);
  });

  it('expands nested fetch failures with cause details', () => {
    const cause = Object.assign(new Error('getaddrinfo ENOTFOUND api.ikuncode.cc'), {
      code: 'ENOTFOUND',
      errno: -3008,
      syscall: 'getaddrinfo',
    });
    const summary = summarizeFailedUpstreamRequest({
      url: 'https://api.ikuncode.cc/v1/responses',
      method: 'POST',
      error: Object.assign(new TypeError('fetch failed'), { cause }),
    });

    expect(summary.errorName).toBe('TypeError');
    expect(summary.errorMessage).toContain('fetch failed');
    expect(summary.errorMessage).toContain('cause=getaddrinfo ENOTFOUND api.ikuncode.cc');
    expect(summary.errorCode).toBeUndefined();
    expect(summary.errorCause).toEqual({
      name: 'Error',
      message: 'getaddrinfo ENOTFOUND api.ikuncode.cc',
      code: 'ENOTFOUND',
    });
    expect(summary.errorCategory).toBe('network');
  });
});
