/**
 * Lightweight natural-language intent parser.
 *
 * Deliberately rule-based so the demo works with zero external calls and is
 * fully predictable for judges. It recognises the four demo intents plus help.
 */
export type Intent =
  | { kind: 'access_review'; name: string; resource: string }
  | { kind: 'investigate'; name: string }
  | { kind: 'admins_no_mfa' }
  | { kind: 'expiring_temp' }
  | { kind: 'help' };

const DEFAULT_RESOURCE = 'Production Database';

export function parseIntent(rawInput: string): Intent {
  const text = stripMention(rawInput).trim();
  const lower = text.toLowerCase();

  // Admins without MFA
  if (/admin/.test(lower) && /(without|no|missing|lack)\s+mfa|mfa/.test(lower)) {
    return { kind: 'admins_no_mfa' };
  }

  // Temporary access expiring
  if (/temp(orary)?\s+access|temp access|tempaccess/.test(lower) || (/temp/.test(lower) && /expir/.test(lower))) {
    return { kind: 'expiring_temp' };
  }

  // Investigate
  const investigate = /\binvestigate\b\s+(.+)/i.exec(text);
  if (investigate) {
    return { kind: 'investigate', name: cleanName(investigate[1]!) };
  }

  // Access review — "Should Rahul receive Production Database access?"
  const review = parseAccessReview(text);
  if (review) return review;

  // Structured "name · resource" (slash-command style)
  const structured = parseStructured(text);
  if (structured) return structured;

  // Bare name → default to a Production Database access review
  if (/^[a-z][a-z .'-]{1,40}$/i.test(text)) {
    return { kind: 'access_review', name: cleanName(text), resource: DEFAULT_RESOURCE };
  }

  return { kind: 'help' };
}

function parseAccessReview(text: string): Intent | null {
  // Should <name> (receive|have|get|be given) <resource> access?
  const m =
    /should\s+(.+?)\s+(?:receive|have|get|be granted|be given|access)\s+(.+?)\s*(?:access)?\??$/i.exec(
      text,
    );
  if (m) {
    const name = cleanName(m[1]!);
    let resource = titleCaseResource(m[2]!);
    if (!resource || /^access$/i.test(resource)) resource = DEFAULT_RESOURCE;
    return { kind: 'access_review', name, resource };
  }
  // "<name> needs/wants access to <resource>"
  const m2 = /(.+?)\s+(?:needs|wants|requesting|requests)\s+access\s+to\s+(.+)/i.exec(text);
  if (m2) {
    return { kind: 'access_review', name: cleanName(m2[1]!), resource: titleCaseResource(m2[2]!) };
  }
  return null;
}

function parseStructured(text: string): Intent | null {
  const parts = text.split(/·|\||,|;| - /).map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 2) {
    return {
      kind: 'access_review',
      name: cleanName(parts[0]!),
      resource: titleCaseResource(parts.slice(1).join(' ')),
    };
  }
  return null;
}

function stripMention(text: string): string {
  return text.replace(/<@[^>]+>/g, '').replace(/@AccessGuard/gi, '').trim();
}

function cleanName(s: string): string {
  return s
    .replace(/[?.!,]+$/g, '')
    .replace(/\b(the|user|employee|for)\b/gi, '')
    .trim();
}

function titleCaseResource(s: string): string {
  return s
    .replace(/[?.!]+$/g, '')
    .replace(/\baccess\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}
