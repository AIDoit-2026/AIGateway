import type { DownstreamFormat } from '../../transformers/shared/chatFormatsCore.js';
import type { UpstreamEndpoint } from '../orchestration/upstreamRequest.js';

/**
 * Wire protocol a request has to be carried by on the upstream side.
 *
 * Every downstream endpoint maps onto exactly one wire protocol. If the target
 * platform does not speak that protocol natively the proxy would have to rewrite
 * the payload into another protocol, which loses protocol-specific semantics
 * (prompt cache breakpoints, thinking blocks, tool id shapes) and silently burns
 * tokens. This module exists so that refusal is an explicit, declared decision
 * instead of an emergent behaviour of the endpoint candidate ordering.
 */
export type UpstreamWireProtocol =
  | 'openai-chat'
  | 'openai-responses'
  | 'anthropic-messages'
  | 'gemini-generate-content';

export type DownstreamProtocolKey = DownstreamFormat | 'responses';

type DownstreamProtocolStory = {
  protocol: UpstreamWireProtocol;
  endpoint: UpstreamEndpoint;
  downstreamPath: string;
};

const DOWNSTREAM_PROTOCOL_STORY: Record<DownstreamProtocolKey, DownstreamProtocolStory> = {
  openai: { protocol: 'openai-chat', endpoint: 'chat', downstreamPath: '/v1/chat/completions' },
  claude: { protocol: 'anthropic-messages', endpoint: 'messages', downstreamPath: '/v1/messages' },
  responses: { protocol: 'openai-responses', endpoint: 'responses', downstreamPath: '/v1/responses' },
};

/**
 * Protocols each platform serves natively, i.e. the upstream accepts the
 * downstream payload on its canonical path without the proxy rewriting it.
 *
 * Platforms absent from this table are multi-protocol relays that expose the
 * canonical OpenAI/Anthropic paths (`DEFAULT_UPSTREAM_PROTOCOLS`).
 *
 * The declaration is guarded by `nativeProtocolSupport.test.ts`, which drives the
 * real `buildUpstreamEndpointRequest()` for every platform/endpoint pair and
 * fails when the declared story and the builder drift apart.
 */
const UPSTREAM_PROTOCOLS_BY_PLATFORM: Record<string, UpstreamWireProtocol[]> = {
  // Dedicated single-protocol adapters.
  codex: ['openai-responses'],
  claude: ['anthropic-messages'],
  // Gemini fronts OpenAI-compatible endpoints under a `/v1beta/openai` base.
  gemini: ['openai-chat', 'openai-responses'],
  // Internal Gemini transports: the request builder always rewrites the body into
  // `generateContent`, so no downstream protocol maps 1:1 onto the upstream wire
  // format.
  'gemini-cli': ['gemini-generate-content'],
  antigravity: ['gemini-generate-content'],
};

const DEFAULT_UPSTREAM_PROTOCOLS: UpstreamWireProtocol[] = [
  'openai-chat',
  'openai-responses',
  'anthropic-messages',
];

export const NATIVE_PROTOCOL_PLATFORM_TABLE = UPSTREAM_PROTOCOLS_BY_PLATFORM;
export const NATIVE_PROTOCOL_DEFAULT = DEFAULT_UPSTREAM_PROTOCOLS;

function normalizePlatformName(platform: unknown): string {
  return typeof platform === 'string' ? platform.trim().toLowerCase() : '';
}

export function resolveDownstreamProtocolStory(
  downstreamFormat: DownstreamProtocolKey,
): DownstreamProtocolStory {
  return DOWNSTREAM_PROTOCOL_STORY[downstreamFormat];
}

export function resolveUpstreamProtocols(sitePlatform?: string | null): UpstreamWireProtocol[] {
  return UPSTREAM_PROTOCOLS_BY_PLATFORM[normalizePlatformName(sitePlatform)]
    ?? DEFAULT_UPSTREAM_PROTOCOLS;
}

export function upstreamSupportsDownstreamProtocol(input: {
  sitePlatform?: string | null;
  downstreamFormat: DownstreamProtocolKey;
}): boolean {
  const required = resolveDownstreamProtocolStory(input.downstreamFormat).protocol;
  return resolveUpstreamProtocols(input.sitePlatform).includes(required);
}

/**
 * Endpoint candidates for strict same-protocol mode.
 *
 * Returns exactly the native endpoint when the upstream speaks the downstream
 * protocol, otherwise an empty list so the caller can reject the request or move
 * on to another channel instead of silently converting protocols.
 */
export function resolveStrictProtocolEndpointCandidates(input: {
  sitePlatform?: string | null;
  downstreamFormat: DownstreamProtocolKey;
}): UpstreamEndpoint[] {
  if (!upstreamSupportsDownstreamProtocol(input)) return [];
  return [resolveDownstreamProtocolStory(input.downstreamFormat).endpoint];
}

export function buildStrictProtocolUnsupportedMessage(input: {
  sitePlatform?: string | null;
  downstreamFormat: DownstreamProtocolKey;
}): string {
  const story = resolveDownstreamProtocolStory(input.downstreamFormat);
  const platform = normalizePlatformName(input.sitePlatform) || 'unknown';
  return [
    `Upstream platform "${platform}" does not natively support ${story.downstreamPath} (${story.protocol}).`,
    'Cross-protocol conversion is disabled, so the request was returned as-is instead of being converted.',
  ].join(' ');
}
