/**
 * Wires Slack events → intent parsing → workflow dispatch → Block Kit.
 * Registers @mentions, five slash commands, and four interactive buttons.
 *
 * Bolt's middleware generics are intentionally treated loosely at this
 * boundary (`any`) — the payloads are dynamic Slack JSON and the rest of
 * the app is fully typed.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import type { App } from '@slack/bolt';
import { createLogger } from '@accessguard/shared';
import { parseIntent } from '../nlp/intent.js';
import {
  runIntent,
  runAgentQuestion,
  handleApprove,
  handleDeny,
  handleTemp,
  handleInvestigate,
} from '../workflows/dispatcher.js';
import { helpView, errorView, type ActionPayload } from './views.js';
import { publishHome, adminsModal, expiringModal, helpModal } from './home.js';
import { assistant } from './assistant.js';
import type { SlackBlock } from './kit.js';

const log = createLogger('slack');

/** Slack requires a `text` fallback alongside `blocks`. */
function message(blocks: SlackBlock[], fallback: string): { blocks: any; text: string } {
  return { blocks: blocks as any, text: fallback };
}

function decodePayload(value: string | undefined): ActionPayload | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as ActionPayload;
  } catch {
    return null;
  }
}

export function registerHandlers(app: App): void {
  // ── Assistant container (Agents & AI Apps surface) ─────────
  try {
    app.assistant(assistant);
  } catch (err) {
    log.warn('Assistant registration skipped', { error: (err as Error).message });
  }

  // ── App Home dashboard ─────────────────────────────────────
  app.event('app_home_opened', async ({ event, client }) => {
    await publishHome(client, (event as { user: string }).user);
  });

  const openModal = async (client: any, body: any, view: unknown): Promise<void> => {
    const triggerId = body?.trigger_id;
    if (triggerId) await client.views.open({ trigger_id: triggerId, view });
  };

  app.action('home_admins', async ({ ack, body, client }) => {
    await ack();
    await openModal(client, body, await adminsModal());
  });
  app.action('home_expiring', async ({ ack, body, client }) => {
    await ack();
    await openModal(client, body, await expiringModal());
  });
  app.action('home_help', async ({ ack, body, client }) => {
    await ack();
    await openModal(client, body, helpModal());
  });
  app.action('home_refresh', async ({ ack, body, client }) => {
    await ack();
    await publishHome(client, (body as { user: { id: string } }).user.id);
  });

  // ── @AccessGuard mentions → autonomous agent ───────────────
  app.event('app_mention', async ({ event, say }) => {
    const text = (event as { text?: string }).text ?? '';
    try {
      // The LLM autonomously selects & chains MCP tools; falls back to the
      // deterministic dispatcher if the LLM is unavailable or errors.
      const blocks = await runAgentQuestion(text);
      await say(message(blocks, 'AccessGuard analysis'));
    } catch (err) {
      log.error('app_mention failed', { error: (err as Error).message });
      await say(message(errorView('Something went wrong while analyzing that request.'), 'Error'));
    }
  });

  // ── Slash commands ─────────────────────────────────────────
  const reply = async (ack: any, respond: any, blocks: SlackBlock[]): Promise<void> => {
    await ack();
    await respond({ response_type: 'in_channel', ...message(blocks, 'AccessGuard') });
  };

  app.command('/access', async ({ command, ack, respond }) => {
    const text = command.text?.trim() || '';
    // Accept "Rahul", "Rahul · Production Database", or a full sentence.
    await reply(ack, respond, text ? await runIntent(parseIntent(text)) : helpView());
  });

  app.command('/investigate', async ({ command, ack, respond }) => {
    const name = command.text?.trim();
    await reply(
      ack,
      respond,
      name ? await runIntent({ kind: 'investigate', name }) : errorView('Usage: `/investigate <name>`'),
    );
  });

  app.command('/risk', async ({ command, ack, respond }) => {
    const text = command.text?.trim() || '';
    await reply(ack, respond, text ? await runIntent(parseIntent(text)) : errorView('Usage: `/risk <name> · <resource>`'));
  });

  app.command('/admins', async ({ ack, respond }) => {
    await reply(ack, respond, await runIntent({ kind: 'admins_no_mfa' }));
  });

  app.command('/tempaccess', async ({ ack, respond }) => {
    await reply(ack, respond, await runIntent({ kind: 'expiring_temp' }));
  });

  // ── Interactive buttons ────────────────────────────────────
  const buttonHandler =
    (fn: (p: ActionPayload) => Promise<SlackBlock[]>) =>
    async ({ ack, body, respond }: any): Promise<void> => {
      await ack();
      const payload = decodePayload(body?.actions?.[0]?.value);
      if (!payload) {
        await respond(message(errorView('Could not read the action payload.'), 'Error'));
        return;
      }
      try {
        const blocks = await fn(payload);
        await respond({ response_type: 'in_channel', ...message(blocks, 'AccessGuard action') });
      } catch (err) {
        log.error('button action failed', { error: (err as Error).message });
        await respond(message(errorView('Action failed to complete.'), 'Error'));
      }
    };

  app.action('access_approve', buttonHandler(handleApprove));
  app.action('access_deny', buttonHandler(handleDeny));
  app.action('access_temp', buttonHandler((p) => handleTemp(p, 4)));
  app.action('access_investigate', buttonHandler(handleInvestigate));

  log.info('Slack handlers registered');
}
