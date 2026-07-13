/**
 * Environment configuration + lightweight `.env` loader (no dependency).
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { REPO_ROOT } from '@accessguard/shared';

/** Minimal .env parser — loads KEY=VALUE lines into process.env if not set. */
function loadDotEnv(): void {
  const envPath = resolve(REPO_ROOT, '.env');
  if (!existsSync(envPath)) return;
  for (const raw of readFileSync(envPath, 'utf8').split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

loadDotEnv();

export interface AppConfig {
  slack: {
    botToken: string;
    appToken: string;
    signingSecret: string;
    configured: boolean;
  };
  llm: {
    apiKey: string | null;
    model: string;
    baseUrl: string | undefined;
    provider: 'openai' | 'openrouter';
    enabled: boolean;
  };
}

// Prefer an explicit OpenRouter key, otherwise fall back to OpenAI.
const openRouterKey = process.env.OPENROUTER_API_KEY || null;
const openAiKey = process.env.OPENAI_API_KEY || null;
const usingOpenRouter = Boolean(openRouterKey);

export const config: AppConfig = {
  slack: {
    botToken: process.env.SLACK_BOT_TOKEN ?? '',
    appToken: process.env.SLACK_APP_TOKEN ?? '',
    signingSecret: process.env.SLACK_SIGNING_SECRET ?? '',
    get configured() {
      return Boolean(this.botToken && this.appToken && this.signingSecret);
    },
  },
  llm: {
    apiKey: usingOpenRouter ? openRouterKey : openAiKey,
    provider: usingOpenRouter ? 'openrouter' : 'openai',
    baseUrl: usingOpenRouter
      ? process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1'
      : process.env.OPENAI_BASE_URL || undefined,
    model: usingOpenRouter
      ? process.env.OPENROUTER_MODEL || process.env.OPENAI_MODEL || 'openai/gpt-4o-mini'
      : process.env.OPENAI_MODEL || 'gpt-4o-mini',
    get enabled() {
      return Boolean(this.apiKey);
    },
  },
};
