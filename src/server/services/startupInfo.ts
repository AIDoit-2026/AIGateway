type StartupSummaryInput = {
  port: number;
  host: string;
  authToken: string;
  proxyToken: string;
  database?: StartupDatabaseInfo;
};

type StartupEndpoints = {
  baseUrl: string;
  adminDashboardUrl: string;
  adminApiExample: string;
  proxyApiExample: string;
  adminApiCurl: string;
  proxyApiCurl: string;
};

type StartupDatabaseInfo = {
  dialect: string;
  connectionString?: string;
  ssl?: boolean;
};

function resolveDisplayHost(host: string): string {
  const trimmed = (host || '').trim();
  if (!trimmed || trimmed === '0.0.0.0' || trimmed === '::') return '127.0.0.1';
  return trimmed;
}

export function buildStartupEndpoints(input: StartupSummaryInput): StartupEndpoints {
  const displayHost = resolveDisplayHost(input.host);
  const baseUrl = `http://${displayHost}:${input.port}`;

  const adminApiExample = `${baseUrl}/api/stats/dashboard`;
  const proxyApiExample = `${baseUrl}/v1/chat/completions`;

  return {
    baseUrl,
    adminDashboardUrl: baseUrl,
    adminApiExample,
    proxyApiExample,
    adminApiCurl: `curl '${adminApiExample}' -H 'Authorization: Bearer ${input.authToken}'`,
    proxyApiCurl: `curl '${proxyApiExample}' -H 'Authorization: Bearer ${input.proxyToken}' -H 'Content-Type: application/json' -d '{"model":"gpt-4o-mini","messages":[{"role":"user","content":"ping"}]}'`,
  };
}

function maskConnectionString(connectionString: string): string {
  try {
    const parsed = new URL(connectionString);
    if (parsed.password) {
      parsed.password = '***';
    }
    return parsed.toString();
  } catch {
    return connectionString;
  }
}

export function buildStartupDatabaseLine(input: StartupDatabaseInfo): string {
  const dialect = (input.dialect || 'unknown').trim() || 'unknown';
  const connection = (input.connectionString || '').trim();
  const displayConnection = dialect === 'sqlite' && !connection
    ? '(default sqlite path)'
    : (connection ? maskConnectionString(connection) : '(empty)');
  const sslLabel = input.ssl ? ' ssl=on' : ' ssl=off';

  return `Database: ${dialect} ${displayConnection}${dialect === 'sqlite' ? '' : sslLabel}`;
}

export function buildStartupSummaryLines(input: StartupSummaryInput): string[] {
  const endpoints = buildStartupEndpoints(input);

  const lines = [
    `metapi running on ${input.host}:${input.port}`,
    `Dashboard: ${endpoints.adminDashboardUrl}`,
    `Admin API: ${endpoints.adminApiExample}`,
    `Proxy API: ${endpoints.proxyApiExample}`,
    `Admin curl: ${endpoints.adminApiCurl}`,
    `Proxy curl: ${endpoints.proxyApiCurl}`,
  ];

  if (input.database) {
    lines.splice(1, 0, buildStartupDatabaseLine(input.database));
  }

  return lines;
}
