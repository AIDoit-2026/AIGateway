import { describe, expect, it } from 'vitest';
import {
  buildStartupDatabaseLine,
  buildStartupEndpoints,
  buildStartupSummaryLines,
} from './startupInfo.js';

describe('startupInfo', () => {
  it('builds single-port endpoint summary for admin and proxy APIs', () => {
    const endpoints = buildStartupEndpoints({
      port: 4000,
      host: '0.0.0.0',
      authToken: 'admin-token',
      proxyToken: 'proxy-token',
    });

    expect(endpoints.baseUrl).toBe('http://127.0.0.1:4000');
    expect(endpoints.adminDashboardUrl).toBe('http://127.0.0.1:4000');
    expect(endpoints.adminApiExample).toBe('http://127.0.0.1:4000/api/stats/dashboard');
    expect(endpoints.proxyApiExample).toBe('http://127.0.0.1:4000/v1/chat/completions');
  });

  it('renders copy-ready startup summary lines', () => {
    const lines = buildStartupSummaryLines({
      port: 4000,
      host: '0.0.0.0',
      authToken: 'admin-token',
      proxyToken: 'proxy-token',
      database: {
        dialect: 'mysql',
        connectionString: 'mysql://user:secret@db.example.com:3306/metapi',
        ssl: true,
      },
    });

    expect(lines.some((line) => line.includes('metapi running'))).toBe(true);
    expect(lines.some((line) => line.includes('Database: mysql mysql://user:***@db.example.com:3306/metapi ssl=on'))).toBe(true);
    expect(lines.some((line) => line.includes('Dashboard: http://127.0.0.1:4000'))).toBe(true);
    expect(lines.some((line) => line.includes('/api/stats/dashboard'))).toBe(true);
    expect(lines.some((line) => line.includes('/v1/chat/completions'))).toBe(true);
  });

  it('renders the default sqlite database path clearly', () => {
    expect(buildStartupDatabaseLine({
      dialect: 'sqlite',
      connectionString: '',
      ssl: false,
    })).toBe('Database: sqlite (default sqlite path)');
  });
});
