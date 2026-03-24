import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the Agent SDK before any imports that use it
vi.mock('@anthropic-ai/claude-agent-sdk', () => ({
  query: vi.fn((_args: unknown) => {
    return (async function* () {
      yield {
        type: 'assistant' as const,
        message: {
          content: [{ type: 'text', text: 'Mocked citizen response about preservation' }],
        },
        parent_tool_use_id: null,
        uuid: 'test-uuid-001',
        session_id: 'test-session-001',
      };
      yield {
        type: 'result' as const,
        subtype: 'success' as const,
        result: 'Mocked citizen response about preservation',
        is_error: false,
        num_turns: 1,
        duration_ms: 100,
        duration_api_ms: 50,
        total_cost_usd: 0.001,
        usage: { input_tokens: 50, output_tokens: 100 },
        modelUsage: {},
        permission_denials: [],
        stop_reason: 'end_turn',
        uuid: 'test-uuid-001',
        session_id: 'test-session-001',
      };
    })();
  }),
}));

describe('LINEAGE Agent SDK Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('query() returns an async generator yielding messages', async () => {
    const { query } = await import('@anthropic-ai/claude-agent-sdk');
    const generator = query({ prompt: 'test prompt', options: {} });
    const messages: unknown[] = [];

    for await (const msg of generator) {
      messages.push(msg);
    }

    expect(messages.length).toBeGreaterThan(0);
  });

  it('produces an assistant message with text content', async () => {
    const { query } = await import('@anthropic-ai/claude-agent-sdk');
    const messages: unknown[] = [];

    for await (const msg of query({ prompt: 'test', options: {} })) {
      messages.push(msg);
    }

    const assistantMsg = messages.find(
      (m: unknown) => (m as { type: string }).type === 'assistant'
    ) as { type: string; message: { content: { type: string; text: string }[] } } | undefined;

    expect(assistantMsg).toBeDefined();
    expect(assistantMsg!.type).toBe('assistant');
    expect(assistantMsg!.message.content).toHaveLength(1);
    expect(assistantMsg!.message.content[0].text).toContain('preservation');
  });

  it('produces a result message with success subtype', async () => {
    const { query } = await import('@anthropic-ai/claude-agent-sdk');
    const messages: unknown[] = [];

    for await (const msg of query({ prompt: 'test', options: {} })) {
      messages.push(msg);
    }

    const resultMsg = messages.find(
      (m: unknown) => (m as { type: string }).type === 'result'
    ) as { type: string; subtype: string; usage: { input_tokens: number; output_tokens: number } } | undefined;

    expect(resultMsg).toBeDefined();
    expect(resultMsg!.type).toBe('result');
    expect(resultMsg!.subtype).toBe('success');
    expect(resultMsg!.usage.input_tokens).toBe(50);
    expect(resultMsg!.usage.output_tokens).toBe(100);
  });

  it('query is called with correct options structure', async () => {
    const { query } = await import('@anthropic-ai/claude-agent-sdk');

    const systemPrompt = 'You are a test citizen.';
    const _generator = query({
      prompt: 'What is worth preserving?',
      options: {
        systemPrompt,
        maxTurns: 1,
        permissionMode: 'dontAsk',
        tools: [],
        persistSession: false,
      },
    });

    // Consume the generator to trigger the mock
    for await (const _msg of _generator) {
      // consume
    }

    expect(query).toHaveBeenCalledWith({
      prompt: 'What is worth preserving?',
      options: {
        systemPrompt: 'You are a test citizen.',
        maxTurns: 1,
        permissionMode: 'dontAsk',
        tools: [],
        persistSession: false,
      },
    });
  });
});
