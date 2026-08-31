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
  durationMs?: number;
}

export interface FailedUpstreamRequestSummary {
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: string;
  status: number | null;
  errorCategory: UpstreamFailureCategory;
  errorName: string;
  errorMessage: string;
  errorCode?: string;
  errorCause?: {
    name: string;
    message: string;
    code?: string;
    cause?: {
      name: string;
      message: string;
      code?: string;
    } | null;
  } | null;
  durationMs?: number;
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

type ErrorLike = {
  name?: unknown;
  message?: unknown;
  code?: unknown;
  errno?: unknown;
  syscall?: unknown;
  cause?: unknown;
};

function asShortString(value: unknown, fallback = ''): string {
  return typeof value === 'string' && value.trim() ? value.trim().slice(0, 512) : fallback;
}

function summarizeErrorCause(error: unknown, depth = 0): FailedUpstreamRequestSummary['errorCause'] {
  if (!error || typeof error !== 'object' || depth > 1) return null;

  const value = error as ErrorLike;
  const name = asShortString(value.name, 'Error') || 'Error';
  const message = asShortString(value.message, '');
  const code = asShortString(value.code, '') || asShortString(value.errno, '') || asShortString(value.syscall, '');
  const nestedCause = summarizeErrorCause(value.cause, depth + 1);

  if (!message && !code && !nestedCause) return null;

  return {
    name,
    message: message || code || 'unknown error',
    ...(code ? { code } : {}),
    ...(nestedCause ? { cause: nestedCause } : {}),
  };
}

function errorText(error: unknown): string {
  if (error instanceof Error) {
    const cause = summarizeErrorCause(error.cause);
    if (cause) {
      const parts = [error.message || 'unknown error', `cause=${cause.message}`];
      if (cause.code) parts.push(`code=${cause.code}`);
      return parts.join('; ');
    }
    return error.message;
  }
  if (typeof error === 'string') return error;
  return '';
}

function classifyFailure(status: number | null | undefined, message: string, body?: string | null): UpstreamFailureCategory {
  if (/timeout|timed out|abort|deadline/i.test(message)) return 'timeout';
  if (/network|socket|fetch failed|connect|dns|econn|undici/i.test(message)) return 'network';
  if (typeof status === 'number' && status >= 400) return 'http';
  if (body !== undefined && body !== null && body.trim().length === 0) return 'empty-response';
  return 'unknown';
}

export function summarizeFailedUpstreamRequest(input: FailedUpstreamRequestInput): FailedUpstreamRequestSummary {
  const message = errorText(input.error);
  const cause = input.error instanceof Error ? summarizeErrorCause(input.error.cause) : summarizeErrorCause((input.error as ErrorLike | null | undefined)?.cause);
  const headers: Record<string, string> = {};
  for (const [name, value] of Object.entries(input.headers || {})) {
    if (typeof value !== 'string') continue;
    headers[name.toLowerCase()] = SENSITIVE_HEADER_NAMES.test(name) ? '[REDACTED]' : value.slice(0, 512);
  }
  const errorName = input.error instanceof Error
    ? asShortString(input.error.name, 'Error') || 'Error'
    : asShortString((input.error as ErrorLike | null | undefined)?.name, 'Error') || 'Error';
  const errorCode = input.error instanceof Error
    ? asShortString((input.error as ErrorLike | null | undefined)?.code, '')
      || asShortString((input.error as ErrorLike | null | undefined)?.errno, '')
      || undefined
    : asShortString((input.error as ErrorLike | null | undefined)?.code, '')
      || asShortString((input.error as ErrorLike | null | undefined)?.errno, '')
      || undefined;
  const body = typeof input.body === 'string' ? redactBody(input.body) : undefined;
  return {
    url: redactUrl(input.url),
    method: (input.method || 'GET').toUpperCase(),
    headers,
    ...(body === undefined ? {} : { body }),
    status: typeof input.status === 'number' ? input.status : null,
    errorCategory: classifyFailure(input.status, message, input.body),
    errorName,
    errorMessage: message.slice(0, 512),
    ...(errorCode ? { errorCode } : {}),
    ...(cause ? { errorCause: cause } : { errorCause: null }),
    ...(typeof input.durationMs === 'number' ? { durationMs: Math.max(0, Math.trunc(input.durationMs)) } : {}),
  };
}

export function logFailedUpstreamRequest(input: FailedUpstreamRequestInput & { scope?: string; requestId?: string }): void {
  const summary = summarizeFailedUpstreamRequest(input);
  console.warn(`[upstream/${input.scope || 'request'}] failed`, {
    requestId: input.requestId,
    ...summary,
  });
}
