import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import {
  NoSuchModelError,
  type EmbeddingModelV4,
  type ImageModelV4,
  type LanguageModelV4,
  type ProviderV4,
} from '@ai-sdk/provider';
import { type FetchFunction, loadApiKey, withoutTrailingSlash } from '@ai-sdk/provider-utils';

/** Default OpenAI-compatible base URL. Claude ids use the same root for `/v1/messages`. */
export const TEAMOROUTER_BASE_URL = 'https://api.teamorouter.com/v1';

/**
 * Model ids served by TeamoRouter. Any id from https://teamorouter.com/models
 * works; the listed ones only drive editor autocompletion.
 */
export type TeamoRouterModelId =
  | 'claude-opus-5-5'
  | 'claude-sonnet-5-5'
  | 'claude-haiku-5-5'
  | 'gpt-5.5'
  | 'gpt-5.4-mini'
  | 'gemini-3.8-flash'
  | 'deepseek-v4-pro'
  | 'deepseek-v4-flash'
  | 'glm-5.3'
  | 'kimi-k3'
  | 'qwen3.8-max'
  | 'qwen3.8-flash'
  | (string & {});

export interface TeamoRouterProviderSettings {
  /** API key. Defaults to the `TEAMOROUTER_API_KEY` environment variable. */
  apiKey?: string;
  /** OpenAI-compatible base URL. Defaults to `https://api.teamorouter.com/v1`. */
  baseURL?: string;
  /** Extra headers sent with every request. */
  headers?: Record<string, string>;
  /** Custom fetch implementation, e.g. for testing or proxies. */
  fetch?: FetchFunction;
}

export interface TeamoRouterProvider extends ProviderV4 {
  (modelId: TeamoRouterModelId): LanguageModelV4;
  /**
   * Chat model. Claude ids (`claude-*`) use TeamoRouter's Anthropic-compatible
   * Messages endpoint; every other id uses OpenAI-compatible chat completions.
   */
  languageModel(modelId: TeamoRouterModelId): LanguageModelV4;
  /** Alias of {@link TeamoRouterProvider.languageModel}. */
  chatModel(modelId: TeamoRouterModelId): LanguageModelV4;
  /** Not supported; throws `NoSuchModelError`. */
  embeddingModel(modelId: string): EmbeddingModelV4;
  /** Not supported; throws `NoSuchModelError`. */
  imageModel(modelId: string): ImageModelV4;
}

/** Tells TeamoRouter which client sent the request. Caller headers override it. */
const CLIENT_HEADERS = { 'X-Client-Source': 'ai-sdk-teamorouter' } as const;

/** Whether an id is served on the Anthropic-compatible Messages endpoint. */
export function isTeamoRouterAnthropicModel(modelId: string): boolean {
  return modelId.startsWith('claude-');
}

export function createTeamoRouter(options: TeamoRouterProviderSettings = {}): TeamoRouterProvider {
  const baseURL = withoutTrailingSlash(options.baseURL) ?? TEAMOROUTER_BASE_URL;
  const headers = { ...CLIENT_HEADERS, ...options.headers };
  const getApiKey = () =>
    loadApiKey({
      apiKey: options.apiKey,
      environmentVariableName: 'TEAMOROUTER_API_KEY',
      description: 'TeamoRouter',
    });

  const createChatModel = (modelId: TeamoRouterModelId): LanguageModelV4 => {
    if (isTeamoRouterAnthropicModel(modelId)) {
      // The Anthropic SDK appends `/messages` to this base URL.
      return createAnthropic({ baseURL, apiKey: getApiKey(), headers, fetch: options.fetch }).languageModel(modelId);
    }
    return createOpenAICompatible({
      name: 'teamorouter',
      baseURL,
      apiKey: getApiKey(),
      headers,
      fetch: options.fetch,
      includeUsage: true,
    }).chatModel(modelId);
  };

  const provider = (modelId: TeamoRouterModelId) => {
    if (new.target) {
      throw new Error('The TeamoRouter model function cannot be called with the new keyword.');
    }
    return createChatModel(modelId);
  };

  provider.specificationVersion = 'v4' as const;
  provider.languageModel = createChatModel;
  provider.chatModel = createChatModel;
  provider.embeddingModel = (modelId: string): EmbeddingModelV4 => {
    throw new NoSuchModelError({ modelId, modelType: 'embeddingModel' });
  };
  provider.imageModel = (modelId: string): ImageModelV4 => {
    throw new NoSuchModelError({ modelId, modelType: 'imageModel' });
  };

  return provider as TeamoRouterProvider;
}

/** Default provider instance; reads the key from `TEAMOROUTER_API_KEY`. */
export const teamorouter = createTeamoRouter();
