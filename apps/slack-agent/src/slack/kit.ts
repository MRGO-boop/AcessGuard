/**
 * Tiny, typed Block Kit builders. Keeping them local avoids scattering
 * verbose block literals throughout the view code and keeps a single,
 * consistent visual language.
 */
export type SlackBlock = Record<string, unknown>;

export const divider = (): SlackBlock => ({ type: 'divider' });

export const header = (text: string): SlackBlock => ({
  type: 'header',
  text: { type: 'plain_text', text: truncate(text, 150), emoji: true },
});

export const section = (markdown: string): SlackBlock => ({
  type: 'section',
  text: { type: 'mrkdwn', text: markdown },
});

/** Two-column field grid inside a section. */
export const fields = (pairs: string[]): SlackBlock => ({
  type: 'section',
  fields: pairs.slice(0, 10).map((text) => ({ type: 'mrkdwn', text })),
});

export const context = (elements: string[]): SlackBlock => ({
  type: 'context',
  elements: elements.map((text) => ({ type: 'mrkdwn', text })),
});

export interface ButtonSpec {
  text: string;
  actionId: string;
  value: string;
  style?: 'primary' | 'danger';
  emoji?: string;
}

export const actions = (buttons: ButtonSpec[]): SlackBlock => ({
  type: 'actions',
  elements: buttons.map((b) => ({
    type: 'button',
    text: { type: 'plain_text', text: `${b.emoji ? b.emoji + ' ' : ''}${b.text}`, emoji: true },
    action_id: b.actionId,
    value: b.value,
    ...(b.style ? { style: b.style } : {}),
  })),
});

function truncate(text: string, max: number): string {
  return text.length > max ? text.slice(0, max - 1) + '…' : text;
}
