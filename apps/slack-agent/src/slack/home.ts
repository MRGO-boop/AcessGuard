/**
 * App Home tab — a live "Security Command Center" dashboard.
 * Published on app_home_opened and refreshable. Quick-action buttons open
 * modals with live detail pulled through the MCP servers.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { createLogger } from '@accessguard/shared';
import { listAdminsWithoutMfa, listExpiringTempAccess, listAllAdmins } from '../mcp/orchestrator.js';
import { adminsWithoutMfaView, expiringAccessView, helpView } from './views.js';
import { header, section, context, divider, fields, actions, type SlackBlock } from './kit.js';

const log = createLogger('home');

/** Builds and publishes the Home tab for a user. */
export async function publishHome(client: any, userId: string): Promise<void> {
  const [noMfa, allAdmins, expiring] = await Promise.all([
    listAdminsWithoutMfa(),
    listAllAdmins(),
    listExpiringTempAccess(),
  ]);

  const noMfaUsers = new Set(noMfa.map((a) => a.userId)).size;
  const totalAdminUsers = new Set(allAdmins.map((a) => a.userId)).size;

  const blocks: SlackBlock[] = [
    header('🛡️ AccessGuard — Security Command Center'),
    section(
      'AI-powered Identity & Access Management, orchestrated across five MCP servers. ' +
        'Ask me anything in a DM or with `@AccessGuard`, or use the actions below.',
    ),
    divider(),
    fields([
      `*🔐 Admins without MFA*\n${noMfaUsers === 0 ? '✅ 0' : `🔴 ${noMfaUsers}`} of ${totalAdminUsers}`,
      `*⏳ Temp access expiring today*\n${expiring.length === 0 ? '✅ 0' : `🟠 ${expiring.length}`}`,
      `*🧠 Reasoning engine*\nDeterministic risk + LLM narrative`,
      `*🔗 MCP servers*\nHR · IAM · Audit · Ticket · Policy`,
    ]),
    divider(),
    section('*Quick actions*'),
    actions([
      { text: 'Admins w/o MFA', actionId: 'home_admins', value: 'admins', emoji: '🔐' },
      { text: 'Expiring Access', actionId: 'home_expiring', value: 'expiring', emoji: '⏳' },
      { text: 'How to use', actionId: 'home_help', value: 'help', emoji: '💡' },
      { text: 'Refresh', actionId: 'home_refresh', value: 'refresh', emoji: '🔄' },
    ]),
  ];

  if (noMfa.length) {
    blocks.push(
      divider(),
      section(
        `*🚨 Top risk — privileged accounts missing MFA*\n` +
          noMfa
            .slice(0, 5)
            .map((a) => `• 🔴 *${a.name}* — ${a.resource} (${a.role})`)
            .join('\n'),
      ),
    );
  }

  blocks.push(
    context([
      `Live data via MCP · Updated ${new Date().toUTCString()}`,
    ]),
  );

  try {
    await client.views.publish({ user_id: userId, view: { type: 'home', blocks } });
  } catch (err) {
    log.warn('Home publish failed (is the Home tab enabled on the app?)', {
      error: (err as Error).message,
    });
  }
}

/** Modal wrapper around a set of blocks. */
export function modal(title: string, blocks: SlackBlock[]): any {
  return {
    type: 'modal',
    title: { type: 'plain_text', text: title.slice(0, 24), emoji: true },
    close: { type: 'plain_text', text: 'Close' },
    blocks,
  };
}

export async function adminsModal(): Promise<any> {
  return modal('Admins without MFA', adminsWithoutMfaView(await listAdminsWithoutMfa()));
}

export async function expiringModal(): Promise<any> {
  return modal('Expiring Access', expiringAccessView(await listExpiringTempAccess()));
}

export function helpModal(): any {
  return modal('AccessGuard Help', helpView());
}
