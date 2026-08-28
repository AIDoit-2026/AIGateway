import { describe, expect, it } from 'vitest';

import {
  hasResponsesWebSearchOnlyRequest,
  validateExternalResponsesHttpRequest,
} from './responsesPreflight.js';

describe('validateExternalResponsesHttpRequest', () => {
  it('allows external HTTP previous_response_id to pass through for upstream validation', () => {
    const responseIdResult = validateExternalResponsesHttpRequest({
      model: 'gpt-5',
      previous_response_id: 'resp_prev_1',
      input: 'hello',
    });
    expect(responseIdResult.ok).toBe(true);

    const messageIdResult = validateExternalResponsesHttpRequest({
      model: 'gpt-5',
      previous_response_id: 'msg_prev_1',
      input: 'hello',
    });
    expect(messageIdResult.ok).toBe(true);
  });

  it('rejects HTTP function_call_output without call_id or local context, but allows matching item_reference', () => {
    const missingCallId = validateExternalResponsesHttpRequest({
      model: 'gpt-5',
      input: [{ type: 'function_call_output', output: 'done' }],
    });
    expect(missingCallId.ok).toBe(false);
    if (!missingCallId.ok) {
      expect(missingCallId.payload.error.message).toContain('requires call_id');
    }

    const missingContext = validateExternalResponsesHttpRequest({
      model: 'gpt-5',
      input: [{ type: 'function_call_output', call_id: 'call_1', output: 'done' }],
    });
    expect(missingContext.ok).toBe(false);
    if (!missingContext.ok) {
      expect(missingContext.payload.error.message).toContain('Responses WebSocket v2');
    }

    expect(validateExternalResponsesHttpRequest({
      model: 'gpt-5',
      input: [
        { type: 'function_call', id: 'fc_1', call_id: 'call_1', name: 'lookup', arguments: '{}' },
        { type: 'function_call_output', call_id: 'call_1', output: 'done' },
      ],
    })).toEqual({ ok: true });

    expect(validateExternalResponsesHttpRequest({
      model: 'gpt-5',
      input: [
        { type: 'function_call', id: 'fc_1', call_id: 'call_other', name: 'lookup', arguments: '{}' },
        { type: 'function_call_output', call_id: 'call_1', item_reference: 'fc_1', output: 'done' },
      ],
    })).toEqual({ ok: true });
  });
});

describe('hasResponsesWebSearchOnlyRequest', () => {
  it('recognizes the current web_search_preview tool alias', () => {
    expect(hasResponsesWebSearchOnlyRequest({
      model: 'gpt-5',
      tools: [{ type: 'web_search_preview_2025_03_11' }],
      input: 'metapi protocol compatibility',
    })).toBe(true);

    expect(hasResponsesWebSearchOnlyRequest({
      model: 'gpt-5',
      tools: [
        { type: 'web_search_preview_2025_03_11' },
        { type: 'function', name: 'lookup' },
      ],
      input: 'metapi protocol compatibility',
    })).toBe(false);
  });
});
