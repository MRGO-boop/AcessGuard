/**
 * Slack Assistant container ("Agents & AI Apps" surface).
 *
 * Gives AccessGuard a first-class agent experience: a dedicated thread with
 * suggested prompts, a live "is analyzing…" status, and answers produced by
 * the autonomous MCP agent loop.
 *
 * Requires the app's Assistant feature enabled + the `assistant:write` scope.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { Assistant } from '@slack/bolt';
import { createLogger } from '@accessguard/shared';
import { runAgentQuestion } from '../workflows/dispatcher.js';

const log = createLogger('assistant');

const SUGGESTED_PROMPTS = {
  title: 'Try an access review:',
  prompts: [
    {
      title: 'Review Rahul for Production DB',
      message: 'Should Rahul receive Production Database access?',
    },
    { title: 'Approve case: Aisha for Production DB', message: 'Should Aisha receive Production Database access?' },
    { title: 'Who has admin access without MFA?', message: 'Who has admin access without MFA?' },
    { title: 'Investigate Leo Fischer', message: 'Investigate Leo Fischer' },
  ],
};

export const assistant = new Assistant({
  threadStarted: async ({ say, setSuggestedPrompts }: any) => {
    try {
      await say(
        "👋 I'm *AccessGuard*, your AI security analyst. I reason over five MCP servers (HR · IAM · Audit · Ticket · Policy) to review access requests and investigate users. Ask me anything, or pick a prompt below.",
      );
      await setSuggestedPrompts(SUGGESTED_PROMPTS);
    } catch (err) {
      log.warn('threadStarted failed', { error: (err as Error).message });
    }
  },

  userMessage: async ({ message, say, setStatus }: any) => {
    const text = (message?.text as string) ?? '';
    try {
      await setStatus('is analyzing across HR · IAM · Audit · Ticket · Policy…');
      const blocks = await runAgentQuestion(text);
      await say({ blocks: blocks as any, text: 'AccessGuard analysis' });
    } catch (err) {
      log.error('assistant userMessage failed', { error: (err as Error).message });
      await say('⚠️ Something went wrong while analyzing that. Please try again.');
    }
  },
});
