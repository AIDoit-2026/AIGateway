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
  });
});
