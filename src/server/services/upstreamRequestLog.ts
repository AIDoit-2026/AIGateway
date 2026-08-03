const SENSITIVE_HEADER_NAMES = /^(authorization|proxy-authorization|cookie|set-cookie|x-api-key|api-key|api_token|token)$/i;
const SENSITIVE_QUERY_NAMES = /(?:^|[-_])(api[-_]?key|token|secret|password|access[-_]?token|authorization)(?:$|[-_])/i;
const MAX_BODY_CHARS = 2_048;

export type UpstreamFailureCategory = 'timeout' | 'http' | 'network' | 'empty-response' | 'unknown';

export interface FailedUpstreamRequestInput {
  url: string;
  method?: string;
  headers?: Record<string, string | undefined>;
  body?: string | null;
  status?: number | null;
  error?: unknown;
}

export interface FailedUpstreamRequestSummary {
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: string;
  status: number | null;
  errorCategory: UpstreamFailureCategory;
  errorMessage: string;
}

function redactUrl(rawUrl: string): string {
  try {
    const url = new URL(rawUrl);
    for (const key of url.searchParams.keys()) {
      if (SENSITIVE_QUERY_NAMES.test(key)) url.searchParams.set(key, '[REDACTED]');
    }
    return url.toString();
  } catch {
    return rawUrl.replace(/((?:api[-_]?key|token|secret|password|access[-_]?token)\s*[=:]\s*)[^&\s]+/gi, '$1[REDACTED]');
  }
}

function redactBody(rawBody: string): string {
  try {
    const redactValue = (value: unknown, key = ''): unknown => {
      if (SENSITIVE_QUERY_NAMES.test(key)) return '[REDACTED]';
      if (Array.isArray(value)) return value.map((item) => redactValue(item));
      if (value && typeof value === 'object') {
        return Object.fromEntries(Object.entries(value as Record<string, unknown>)
          .map(([entryKey, entryValue]) => [entryKey, redactValue(entryValue, entryKey)]));
      }
      return value;
    };
    return JSON.stringify(redactValue(JSON.parse(rawBody))).slice(0, MAX_BODY_CHARS);
  } catch {
    return rawBody.slice(0, MAX_BODY_CHARS);
  }
}

function errorText(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return '';
}

function classifyFailure(status: number | null | undefined, message: string, body?: string | null): UpstreamFailureCategory {
  if (/timeout|timed out|abort|deadline/i.test(message)) return 'timeout';
  if (typeof status === 'number' && status >= 400) return 'http';
  if (body !== undefined && body !== null && body.trim().length === 0) return 'empty-response';
  if (/network|socket|fetch failed|connect|dns|econn|undici/i.test(message)) return 'network';
  return 'unknown';
}

export function summarizeFailedUpstreamRequest(input: FailedUpstreamRequestInput): FailedUpstreamRequestSummary {
  const message = errorText(input.error);
  const headers: Record<string, string> = {};
  for (const [name, value] of Object.entries(input.headers || {})) {
    if (typeof value !== 'string') continue;
    headers[name.toLowerCase()] = SENSITIVE_HEADER_NAMES.test(name) ? '[REDACTED]' : value.slice(0, 512);
  }
  const body = typeof input.body === 'string' ? redactBody(input.body) : undefined;
  return {
    url: redactUrl(input.url),
    method: (input.method || 'GET').toUpperCase(),
    headers,
    ...(body === undefined ? {} : { body }),
    status: typeof input.status === 'number' ? input.status : null,
    errorCategory: classifyFailure(input.status, message, input.body),
    errorMessage: message.slice(0, 512),
  };
}

export function logFailedUpstreamRequest(input: FailedUpstreamRequestInput & { scope?: string; requestId?: string }): void {
  const summary = summarizeFailedUpstreamRequest(input);
  console.warn(`[upstream/${input.scope || 'request'}] failed`, {
    requestId: input.requestId,
    ...summary,
  });
}
