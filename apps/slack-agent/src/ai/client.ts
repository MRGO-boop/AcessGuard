/** Shared LLM client (OpenAI SDK, pointed at OpenAI or OpenRouter). */
import OpenAI from 'openai';
import { config } from '../config.js';

export const llmEnabled = config.llm.enabled;
export const llmModel = config.llm.model;

export const llm: OpenAI | null = config.llm.enabled
  ? new OpenAI({
      apiKey: config.llm.apiKey!,
      baseURL: config.llm.baseUrl,
      defaultHeaders:
        config.llm.provider === 'openrouter'
          ? { 'HTTP-Referer': 'https://accessguard.ai', 'X-Title': 'AccessGuard AI' }
          : undefined,
    })
  : null;
