/**
 * Minimal structured logger — zero dependencies.
 *
 * MCP servers communicate over stdout via JSON-RPC, so all diagnostic
 * logging MUST go to stderr to avoid corrupting the protocol stream.
 */
type Level = 'debug' | 'info' | 'warn' | 'error';

const LEVELS: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };

const activeLevel: Level = (process.env.LOG_LEVEL as Level) ?? 'info';
const threshold = LEVELS[activeLevel] ?? LEVELS.info;

const COLORS: Record<Level, string> = {
  debug: '\x1b[90m',
  info: '\x1b[36m',
  warn: '\x1b[33m',
  error: '\x1b[31m',
};
const RESET = '\x1b[0m';

function emit(level: Level, scope: string, msg: string, meta?: unknown): void {
  if (LEVELS[level] < threshold) return;
  const ts = new Date().toISOString();
  const color = COLORS[level];
  const prefix = `${color}${ts} ${level.toUpperCase().padEnd(5)}${RESET} [${scope}]`;
  const line = meta !== undefined ? `${prefix} ${msg} ${safeJson(meta)}` : `${prefix} ${msg}`;
  // Always stderr: keeps MCP stdout clean.
  process.stderr.write(line + '\n');
}

function safeJson(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export interface Logger {
  debug(msg: string, meta?: unknown): void;
  info(msg: string, meta?: unknown): void;
  warn(msg: string, meta?: unknown): void;
  error(msg: string, meta?: unknown): void;
}

export function createLogger(scope: string): Logger {
  return {
    debug: (msg, meta) => emit('debug', scope, msg, meta),
    info: (msg, meta) => emit('info', scope, msg, meta),
    warn: (msg, meta) => emit('warn', scope, msg, meta),
    error: (msg, meta) => emit('error', scope, msg, meta),
  };
}
