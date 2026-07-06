import type { FastifyInstance } from 'fastify';

const DESKTOP_HEALTH_ROUTE = '/api/desktop/health';
const PUBLIC_DOWNSTREAM_KEY_USAGE_PREFIX = '/api/public/downstream-keys/';

export function isPublicApiRoute(url: string): boolean {
  return url === DESKTOP_HEALTH_ROUTE
    || url.startsWith('/api/oauth/callback/')
    || url.startsWith(PUBLIC_DOWNSTREAM_KEY_USAGE_PREFIX);
}

export async function registerDesktopRoutes(app: FastifyInstance) {
  app.get(DESKTOP_HEALTH_ROUTE, async () => ({ ok: true }));
}
