import { AsyncLocalStorage } from 'node:async_hooks';
import { logFailedUpstreamRequest } from './upstreamRequestLog.js';

type VerifyTokenContext = { requestId: string; platform: string };
const contextStorage = new AsyncLocalStorage<VerifyTokenContext>();

export function runVerifyTokenContext<T>(context: VerifyTokenContext, callback: () => Promise<T>): Promise<T> {
  return contextStorage.run(context, callback);
}

export function logVerifyTokenUpstreamFailure(input: {
  stage: string;
  url: string;
  method?: string;
  headers?: Record<string, string | undefined>;
  body?: string | null;
  status?: number | null;
  durationMs?: number;
  error?: unknown;
}): void {
  const context = contextStorage.getStore();
  logFailedUpstreamRequest({
    scope: `verify-token/${input.stage}`,
    requestId: context?.requestId,
    ...input,
  });
}

export function logVerifyTokenFailure(input: {
  requestId: string;
  stage: string;
  siteId?: number;
  platform?: string;
  message: string;
  credentialMode?: string;
}): void {
  console.warn('[accounts/verify-token] failed', input);
}
