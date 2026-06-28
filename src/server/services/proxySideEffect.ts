const lastWarnAt = new Map<string, number>();
const WARN_INTERVAL_MS = 30_000;

function warnSideEffectFailure(label: string, error: unknown) {
  const now = Date.now();
  const last = lastWarnAt.get(label) || 0;
  if (now - last < WARN_INTERVAL_MS) return;
  lastWarnAt.set(label, now);
  console.warn(`[proxy-side-effect] ${label} failed`, error);
}

export function runProxySideEffect(label: string, fn: () => Promise<unknown> | unknown) {
  void Promise.resolve()
    .then(fn)
    .catch((error) => warnSideEffectFailure(label, error));
}

export function enqueueProxySideEffect(label: string, fn: () => Promise<unknown> | unknown) {
  runProxySideEffect(label, fn);
}
