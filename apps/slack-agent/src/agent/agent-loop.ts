/**
 * Agentic tool-calling loop.
 *
 * Unlike the deterministic dispatcher (which hard-codes which MCP tools run
 * for each intent), this lets the LLM *decide* which of the 40+ MCP tools to
 * call, in what order, and when it has enough information to answer. Every
 * tool call is recorded so the UI can show the agent's real reasoning path.
 *
 * The deterministic risk engine is exposed as the `policy__evaluatePolicy`
 * tool — the model must call it for any access decision, so scoring stays
 * non-hallucinated even though the agent is fully autonomous.
 */
import type OpenAI from 'openai';
import { createLogger } from '@accessguard/shared';
import { mcp, type ServerName, type ToolDef } from '../mcp/client-manager.js';
import { llm, llmModel } from '../ai/client.js';

const log = createLogger('agent');

export interface TraceEntry {
  server: ServerName;
  tool: string;
  args: Record<string, unknown>;
}

export interface ToolCallRecord extends TraceEntry {
  result: unknown;
}

export interface AgentResult {
  answer: string;
  trace: TraceEntry[];
  calls: ToolCallRecord[];
  steps: number;
  usedLlm: boolean;
}

const MAX_STEPS = 6;
const NAME_SEP = '__';

const AGENT_SYSTEM = `You are AccessGuard, an autonomous enterprise security analyst operating inside Slack.

You have live tools across five systems: HR, IAM (identity/access), Audit (security logs), Ticket (ITSM), and Policy (risk engine).

HOW TO WORK:
- Decide which tools to call to answer the admin's question. Gather facts before concluding.
- For ANY access-approval decision, you MUST call policy__evaluatePolicy with the signals you gathered (mfaEnabled, isContractor, hasApprovalTicket, hasForeignLogin, failedLoginCount, employmentActive, hasManagerApproval, securityTrainingComplete, onCall, resource). Treat its returned score, level and policyViolations as GROUND TRUTH — never invent a score.
- Resolve people by name using HR tools (e.g. "Rahul" → getEmployee).
- Do not fabricate data. If a tool returns nothing, say so.

FINAL ANSWER FORMAT (Slack mrkdwn, concise):
- Lead with the recommendation in bold when it's an access decision (APPROVE / APPROVE WITH CONDITIONS / DENY / ESCALATE).
- Include the risk level + score from the policy engine.
- 2–4 sentences of reasoning grounded in the facts you retrieved.
- A short bulleted list of the key findings.
Keep it tight and professional.`;

/** Converts MCP tool defs into OpenAI function-calling tools. */
function buildTools(defs: ToolDef[]): {
  tools: OpenAI.Chat.Completions.ChatCompletionTool[];
  route: Map<string, { server: ServerName; tool: string }>;
} {
  const route = new Map<string, { server: ServerName; tool: string }>();
  const tools = defs.map((d) => {
    const fnName = `${d.server}${NAME_SEP}${d.name}`;
    route.set(fnName, { server: d.server, tool: d.name });
    const schema = { type: 'object', properties: {}, ...d.inputSchema } as Record<string, unknown>;
    return {
      type: 'function' as const,
      function: {
        name: fnName,
        description: `[${d.server}] ${d.description}`,
        parameters: schema,
      },
    };
  });
  return { tools, route };
}

/** Runs the autonomous loop for a single admin question. */
export async function runAgent(question: string): Promise<AgentResult> {
  if (!llm) throw new Error('LLM not configured — agent loop requires an API key.');

  const defs = await mcp.listAllToolDefs();
  const { tools, route } = buildTools(defs);

  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: 'system', content: AGENT_SYSTEM },
    { role: 'user', content: question },
  ];

  const trace: TraceEntry[] = [];
  const calls: ToolCallRecord[] = [];

  for (let step = 1; step <= MAX_STEPS; step++) {
    const completion = await llm.chat.completions.create({
      model: llmModel,
      temperature: 0.2,
      messages,
      tools,
      tool_choice: 'auto',
    });

    const msg = completion.choices[0]?.message;
    if (!msg) break;
    messages.push(msg);

    if (!msg.tool_calls?.length) {
      log.info('Agent finished', { steps: step, toolCalls: calls.length });
      return { answer: msg.content ?? '', trace, calls, steps: step, usedLlm: true };
    }

    // Execute every requested tool call and feed results back.
    for (const tc of msg.tool_calls) {
      if (tc.type !== 'function') continue;
      const target = route.get(tc.function.name);
      const args = safeParse(tc.function.arguments);
      let result: unknown;
      if (!target) {
        result = { error: `Unknown tool ${tc.function.name}` };
      } else {
        try {
          result = await mcp.call(target.server, target.tool, args);
          trace.push({ server: target.server, tool: target.tool, args });
          calls.push({ server: target.server, tool: target.tool, args, result });
        } catch (err) {
          result = { error: (err as Error).message };
        }
      }
      messages.push({
        role: 'tool',
        tool_call_id: tc.id,
        content: JSON.stringify(result).slice(0, 4000),
      });
    }
  }

  // Ran out of steps — force a final synthesis without more tools.
  const final = await llm.chat.completions.create({
    model: llmModel,
    temperature: 0.2,
    messages: [
      ...messages,
      { role: 'user', content: 'You have gathered enough. Provide your final answer now.' },
    ],
  });
  return {
    answer: final.choices[0]?.message?.content ?? 'Unable to complete the analysis.',
    trace,
    calls,
    steps: MAX_STEPS,
    usedLlm: true,
  };
}

function safeParse(json: string | undefined): Record<string, unknown> {
  if (!json) return {};
  try {
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return {};
  }
}
