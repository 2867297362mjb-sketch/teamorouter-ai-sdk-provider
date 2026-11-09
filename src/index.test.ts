import { generateText } from 'ai';
import { describe, expect, it } from 'vitest';
import { createTeamoRouter } from './index';

type Call = { url: string; headers: Headers; body: Record<string, unknown> };

function recordingFetch(calls: Call[], response: (url: string) => Response) {
  return async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, headers: new Headers(init?.headers), body: JSON.parse(String(init?.body ?? '{}')) });
    return response(url);
  };
}

const chatCompletion = () =>
  new Response(
    JSON.stringify({
      id: 'chatcmpl-1',
      object: 'chat.completion',
      created: 1,
      model: 'deepseek-v4-flash',
      choices: [{ index: 0, message: { role: 'assistant', content: 'OK' }, finish_reason: 'stop' }],
      usage: { prompt_tokens: 3, completion_tokens: 1, total_tokens: 4 },
    }),
    { headers: { 'content-type': 'application/json' } },
  );

const anthropicMessage = () =>
  new Response(
    JSON.stringify({
      id: 'msg_1',
      type: 'message',
      role: 'assistant',
      model: 'claude-sonnet-5-5',
      content: [{ type: 'text', text: 'OK' }],
      stop_reason: 'end_turn',
      usage: { input_tokens: 3, output_tokens: 1 },
    }),
    { headers: { 'content-type': 'application/json' } },
  );

describe('createTeamoRouter', () => {
  it('sends non-Claude ids to OpenAI-compatible chat completions with the key and source header', async () => {
    const calls: Call[] = [];
    const teamorouter = createTeamoRouter({ apiKey: 'sk-test', fetch: recordingFetch(calls, chatCompletion) });
    const { text } = await generateText({ model: teamorouter('deepseek-v4-flash'), prompt: 'Hi' });
    expect(text).toBe('OK');
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe('https://api.teamorouter.com/v1/chat/completions');
    expect(calls[0].headers.get('authorization')).toBe('Bearer sk-test');
    expect(calls[0].headers.get('x-client-source')).toBe('ai-sdk-teamorouter');
    expect(calls[0].body.model).toBe('deepseek-v4-flash');
  });

  it('sends Claude ids to the Anthropic-compatible Messages endpoint', async () => {
    const calls: Call[] = [];
    const teamorouter = createTeamoRouter({ apiKey: 'sk-test', fetch: recordingFetch(calls, anthropicMessage) });
    const { text } = await generateText({ model: teamorouter('claude-sonnet-5-5'), prompt: 'Hi' });
    expect(text).toBe('OK');
    expect(calls[0].url).toBe('https://api.teamorouter.com/v1/messages');
    expect(calls[0].headers.get('x-api-key')).toBe('sk-test');
    expect(calls[0].headers.get('x-client-source')).toBe('ai-sdk-teamorouter');
    expect(calls[0].body.model).toBe('claude-sonnet-5-5');
  });

  it('reads the key from TEAMOROUTER_API_KEY and lets caller headers override the default', async () => {
    const calls: Call[] = [];
    process.env.TEAMOROUTER_API_KEY = 'sk-env';
    try {
      const teamorouter = createTeamoRouter({
        baseURL: 'https://gw.example.com/v1/',
        headers: { 'X-Client-Source': 'my-app' },
        fetch: recordingFetch(calls, chatCompletion),
      });
      await generateText({ model: teamorouter.languageModel('glm-5.3'), prompt: 'Hi' });
    } finally {
      delete process.env.TEAMOROUTER_API_KEY;
    }
    expect(calls[0].url).toBe('https://gw.example.com/v1/chat/completions');
    expect(calls[0].headers.get('authorization')).toBe('Bearer sk-env');
    expect(calls[0].headers.get('x-client-source')).toBe('my-app');
  });

  it('throws for unsupported model types', () => {
    const teamorouter = createTeamoRouter({ apiKey: 'sk-test' });
    expect(() => teamorouter.embeddingModel('text-embedding-3-small')).toThrow();
    expect(() => teamorouter.imageModel('gpt-image-2')).toThrow();
  });
});
