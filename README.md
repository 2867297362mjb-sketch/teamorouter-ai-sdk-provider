# TeamoRouter provider for the Vercel AI SDK

[TeamoRouter](https://teamorouter.com) is a pay-as-you-go gateway with one API key for Claude, GPT, Gemini, DeepSeek, GLM, Kimi, and Qwen models. This package lets the [Vercel AI SDK](https://ai-sdk.dev) use it.

> Maintained by TeamoRouter (the author works at TeamoRouter).

- Claude models (`claude-*`) go to TeamoRouter's Anthropic-compatible Messages endpoint through `@ai-sdk/anthropic`, so prompt caching, thinking, and tool use behave as they do on Anthropic's own API.
- Every other model goes to the OpenAI-compatible Chat Completions endpoint through `@ai-sdk/openai-compatible`.

## Install

```bash
npm install @teamorouter/ai-sdk-provider ai
```

## Setup

Create an API key in the [TeamoRouter dashboard](https://teamorouter.com/dashboard) and set it as `TEAMOROUTER_API_KEY`:

```bash
export TEAMOROUTER_API_KEY="your-api-key"
```

## Usage

```ts
import { generateText } from 'ai';
import { teamorouter } from '@teamorouter/ai-sdk-provider';

const { text } = await generateText({
  model: teamorouter('claude-sonnet-5-5'),
  prompt: 'Write a haiku about routers.',
});
```

Streaming and tools work the same way:

```ts
import { streamText, tool, stepCountIs } from 'ai';
import { z } from 'zod';
import { teamorouter } from '@teamorouter/ai-sdk-provider';

const result = streamText({
  model: teamorouter('deepseek-v4-flash'),
  tools: {
    weather: tool({
      description: 'Get the weather for a city',
      inputSchema: z.object({ city: z.string() }),
      execute: async ({ city }) => ({ city, tempC: 21 }),
    }),
  },
  stopWhen: stepCountIs(3),
  prompt: 'What is the weather in Lisbon?',
});

for await (const part of result.textStream) process.stdout.write(part);
```

### Custom settings

```ts
import { createTeamoRouter } from '@teamorouter/ai-sdk-provider';

const teamorouter = createTeamoRouter({
  apiKey: process.env.MY_TEAMOROUTER_KEY, // defaults to TEAMOROUTER_API_KEY
  baseURL: 'https://api.teamorouter.com/v1', // default
  headers: { 'X-Client-Source': 'my-app' }, // optional, overrides the default tag
});
```

## Models

Any chat model id from [teamorouter.com/models](https://teamorouter.com/models) works, for example `claude-opus-5-5`, `claude-sonnet-5-5`, `claude-haiku-5-5`, `gpt-5.5`, `gpt-5.4-mini`, `gemini-3.8-flash`, `deepseek-v4-pro`, `deepseek-v4-flash`, `glm-5.3`, `kimi-k3`, and `qwen3.8-max`. A machine-readable list with context windows and prices is at [api.teamorouter.com/v1/models/pricing](https://api.teamorouter.com/v1/models/pricing).

Only language models are supported. `embeddingModel()` and `imageModel()` throw `NoSuchModelError`.

## What gets sent

- Your API key and requests go to `api.teamorouter.com` only, or to your `baseURL`.
- Every request carries `X-Client-Source: ai-sdk-teamorouter`, so TeamoRouter can tell which traffic comes from this package. Pass your own `X-Client-Source` in `headers` to change it.

## License

MIT
