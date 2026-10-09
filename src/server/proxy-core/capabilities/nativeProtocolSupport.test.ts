import { describe, expect, it } from 'vitest';
import { buildUpstreamEndpointRequest } from '../../services/upstreamRequestBuilder.js';
import type { UpstreamEndpoint } from '../orchestration/upstreamRequest.js';
import {
  NATIVE_PROTOCOL_DEFAULT,
  NATIVE_PROTOCOL_PLATFORM_TABLE,
  type UpstreamWireProtocol,
  resolveStrictProtocolEndpointCandidates,
  resolveUpstreamProtocols,
  upstreamSupportsDownstreamProtocol,
} from './nativeProtocolSupport.js';

const CANONICAL_PATH_BY_ENDPOINT: Record<UpstreamEndpoint, string> = {
  chat: '/v1/chat/completions',
  messages: '/v1/messages',
  responses: '/v1/responses',
};

const ALL_ENDPOINTS: UpstreamEndpoint[] = ['chat', 'messages', 'responses'];

const PLATFORMS = [
  ...Object.keys(NATIVE_PROTOCOL_PLATFORM_TABLE),
  'openai',
  'new-api',
  'anyrouter',
  'sub2api',
  'unknown-platform',
];

function readArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

/**
 * Classifies the wire protocol of an upstream body by shape only, so the
 * assertion does not depend on the base path a platform happens to mount the
 * protocol under.
 */
function classifyUpstreamBodyShape(body: Record<string, unknown>): UpstreamWireProtocol | 'unknown' {
  if (readArray(body.contents).length > 0) return 'gemini-generate-content';
  const nestedRequest = body.request;
  if (nestedRequest && typeof nestedRequest === 'object') {
    if (readArray((nestedRequest as Record<string, unknown>).contents).length > 0) {
      return 'gemini-generate-content';
    }
  }

  const messages = readArray(body.messages);
  if (messages.length > 0) {
    const first = messages[0];
    const content = first && typeof first === 'object'
      ? (first as Record<string, unknown>).content
      : undefined;
    // Anthropic Messages carries content blocks; OpenAI chat carries a string.
    return Array.isArray(content) ? 'anthropic-messages' : 'openai-chat';
  }

  if (readArray(body.input).length > 0) return 'openai-responses';

  return 'unknown';
}

function buildRequest(input: {
  sitePlatform: string;
  endpoint: UpstreamEndpoint;
}): { path: string; body: Record<string, unknown> } {
  const request = buildUpstreamEndpointRequest({
    endpoint: input.endpoint,
    modelName: 'claude-sonnet-4-5-20250929',
    stream: false,
    tokenValue: 'sk-guard-test',
    sitePlatform: input.sitePlatform,
    siteUrl: 'https://upstream.example.com',
    oauthProjectId: 'guard-project-id',
    openaiBody: {
      model: 'claude-sonnet-4-5-20250929',
      messages: [{ role: 'user', content: 'hi' }],
    },
    downstreamFormat: 'claude',
    claudeOriginalBody: {
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 64,
      system: 'sys',
      messages: [{ role: 'user', content: [{ type: 'text', text: 'hi' }] }],
    },
  });
  return { path: request.path, body: request.body as Record<string, unknown> };
}

function downstreamFormatForEndpoint(endpoint: UpstreamEndpoint): 'claude' | 'responses' | 'openai' {
  if (endpoint === 'messages') return 'claude';
  if (endpoint === 'responses') return 'responses';
  return 'openai';
}

function requiredProtocolForEndpoint(endpoint: UpstreamEndpoint): UpstreamWireProtocol {
  if (endpoint === 'messages') return 'anthropic-messages';
  if (endpoint === 'responses') return 'openai-responses';
  return 'openai-chat';
}

describe('nativeProtocolSupport declaration', () => {
  it('builds a body in the declared protocol whenever the platform claims native support', () => {
    const problems: string[] = [];

    for (const sitePlatform of PLATFORMS) {
      for (const endpoint of ALL_ENDPOINTS) {
        const supported = upstreamSupportsDownstreamProtocol({
          sitePlatform,
          downstreamFormat: downstreamFormatForEndpoint(endpoint),
        });
        if (!supported) continue;

        const { path, body } = buildRequest({ sitePlatform, endpoint });
        const shape = classifyUpstreamBodyShape(body);
        const required = requiredProtocolForEndpoint(endpoint);
        if (shape !== required) {
          problems.push(
            `${sitePlatform}/${endpoint}: declared native ${required} but the builder produced ${shape} (path=${path})`,
          );
        }
      }
    }

    expect(problems).toEqual([]);
  });

  it('only refuses platforms that would otherwise be converted or sent to a non-native path', () => {
    const problems: string[] = [];

    for (const sitePlatform of PLATFORMS) {
      for (const endpoint of ALL_ENDPOINTS) {
        const supported = upstreamSupportsDownstreamProtocol({
          sitePlatform,
          downstreamFormat: downstreamFormatForEndpoint(endpoint),
        });
        if (supported) continue;

        const required = requiredProtocolForEndpoint(endpoint);
        const { path, body } = buildRequest({ sitePlatform, endpoint });
        const shape = classifyUpstreamBodyShape(body);
        const usesNativePath = path === CANONICAL_PATH_BY_ENDPOINT[endpoint];
        if (shape === required && usesNativePath) {
          problems.push(
            `${sitePlatform}/${endpoint}: refused but the builder already produced native ${shape} on ${path}`,
          );
        }
      }
    }

    expect(problems).toEqual([]);
  });

  it('declares exactly the platform stories the proxy relies on', () => {
    expect(NATIVE_PROTOCOL_DEFAULT).toEqual([
      'openai-chat',
      'openai-responses',
      'anthropic-messages',
    ]);
    expect(resolveUpstreamProtocols('codex')).toEqual(['openai-responses']);
    expect(resolveUpstreamProtocols('claude')).toEqual(['anthropic-messages']);
    expect(resolveUpstreamProtocols('gemini')).toEqual(['openai-chat', 'openai-responses']);
    expect(resolveUpstreamProtocols('gemini-cli')).toEqual(['gemini-generate-content']);
    expect(resolveUpstreamProtocols('antigravity')).toEqual(['gemini-generate-content']);
    expect(resolveUpstreamProtocols('new-api')).toEqual(NATIVE_PROTOCOL_DEFAULT);
    expect(resolveUpstreamProtocols(undefined)).toEqual(NATIVE_PROTOCOL_DEFAULT);
  });
});

describe('resolveStrictProtocolEndpointCandidates', () => {
  it('pins /v1/messages to the native /v1/messages endpoint on multi-protocol relays', () => {
    for (const sitePlatform of ['openai', 'new-api', 'anyrouter', 'sub2api', 'unknown-platform']) {
      expect(resolveStrictProtocolEndpointCandidates({
        sitePlatform,
        downstreamFormat: 'claude',
      })).toEqual(['messages']);
    }
  });

  it('keeps the dedicated claude upstream on /v1/messages', () => {
    expect(resolveStrictProtocolEndpointCandidates({
      sitePlatform: 'claude',
      downstreamFormat: 'claude',
    })).toEqual(['messages']);
  });

  it('refuses /v1/messages for platforms that would have to convert the payload', () => {
    for (const sitePlatform of ['codex', 'gemini', 'gemini-cli', 'antigravity']) {
      expect(resolveStrictProtocolEndpointCandidates({
        sitePlatform,
        downstreamFormat: 'claude',
      })).toEqual([]);
    }
  });

  it('resolves the responses and chat protocols symmetrically', () => {
    expect(resolveStrictProtocolEndpointCandidates({
      sitePlatform: 'codex',
      downstreamFormat: 'responses',
    })).toEqual(['responses']);
    expect(resolveStrictProtocolEndpointCandidates({
      sitePlatform: 'gemini',
      downstreamFormat: 'responses',
    })).toEqual(['responses']);
    expect(resolveStrictProtocolEndpointCandidates({
      sitePlatform: 'claude',
      downstreamFormat: 'responses',
    })).toEqual([]);
    expect(resolveStrictProtocolEndpointCandidates({
      sitePlatform: 'claude',
      downstreamFormat: 'openai',
    })).toEqual([]);
    expect(resolveStrictProtocolEndpointCandidates({
      sitePlatform: 'gemini-cli',
      downstreamFormat: 'openai',
    })).toEqual([]);
  });
});
