/**
 * Anthropic SDK client + prompt builders for the skill-authoring loop.
 *
 * Three flows:
 *   - trigger : "Would Claude select this skill given the user's prompt?"  (cheap, JSON output)
 *   - apply   : "Run the user's prompt through Claude with this skill loaded as if Claude Code injected it."
 *   - sharpen : "Critique this skill description and propose a sharper version." (JSON output)
 *
 * Model: `apply` targets `claude-opus-4-8` (the current Opus) to match what Claude Code
 * actually runs, giving realistic output. `trigger` and `sharpen` are lightweight JSON
 * critique flows and stay on `claude-haiku-4-5` — routing decisions and description
 * critiques don't need Opus, and these run on every test-bench keystroke. No sampling
 * params (temperature/top_p are rejected on current models); `apply` uses adaptive
 * thinking + effort. The JSON flows constrain output with `output_config.format`
 * (structured outputs), which both models support.
 *
 * Prompt caching: the system prompts are static across calls; cache them at the breakpoint.
 */

import Anthropic from "@anthropic-ai/sdk";

let _client: Anthropic | null = null;

export function getClient(): Anthropic {
  if (_client) return _client;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new MissingApiKeyError();
  }
  _client = new Anthropic({ apiKey });
  return _client;
}

export class MissingApiKeyError extends Error {
  readonly code = "missing_api_key" as const;
  constructor() {
    super("ANTHROPIC_API_KEY is not set in the environment");
  }
}

// ---------------------------------------------------------------------------
// Trigger evaluator
// ---------------------------------------------------------------------------

const TRIGGER_SYSTEM = `You evaluate whether a Claude Code skill would be selected for a given user message.

A skill is metadata Claude Code uses to route user prompts to specialized instructions. The metadata is the skill's "description" field — Claude reads it and decides whether the skill is relevant to the current user message. The skill's body is NOT visible during this routing decision; only the description is.

Your job: given a description and a user message, predict whether Claude Code would invoke this skill.

Be honest and calibrated:
- If the description names file extensions, languages, or trigger phrases that match the user's message → high confidence trigger.
- If the description is vague ("React patterns") and the user's message is vague ("help me") → low confidence either way.
- If the description specifies a language/framework that doesn't match the user's message → confidently no.
- If the description matches the user's TOPIC but a different STACK (e.g. skill is for Vue, user asks about React) → no.

Return ONLY the JSON specified by the output schema — no prose, no preamble.`;

export type TriggerResult = {
  triggered: boolean;
  confidence: number;
  reasoning: string;
};

export async function evaluateTrigger(args: {
  description: string;
  userPrompt: string;
}): Promise<TriggerResult> {
  const client = getClient();
  const response = await client.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 512,
    system: [
      {
        type: "text",
        text: TRIGGER_SYSTEM,
        cache_control: { type: "ephemeral" },
      },
    ],
    output_config: {
      format: {
        type: "json_schema",
        schema: {
          type: "object",
          properties: {
            triggered: { type: "boolean" },
            confidence: {
              type: "number",
              description: "0 to 1, how confident you are in the triggered decision",
            },
            reasoning: {
              type: "string",
              description: "One or two sentences explaining the decision.",
            },
          },
          required: ["triggered", "confidence", "reasoning"],
          additionalProperties: false,
        },
      },
    },
    messages: [
      {
        role: "user",
        content: `SKILL DESCRIPTION:\n"""\n${args.description}\n"""\n\nUSER MESSAGE:\n"""\n${args.userPrompt}\n"""`,
      },
    ],
  });

  return parseFirstJson<TriggerResult>(response);
}

// ---------------------------------------------------------------------------
// Apply mode (run a prompt with the skill body loaded)
// ---------------------------------------------------------------------------

const APPLY_SYSTEM_PREAMBLE = `You are Claude Code with a skill loaded into context. The skill below was selected to handle the user's message — apply its guidance when responding.

If the skill is genuinely relevant, follow its recipe and reference its patterns. If on reflection it's not the right tool for the job, say so briefly and answer the user as best you can without it. Be concise; this is a test run, not a chat session.

--- SKILL BODY ---
`;

export type ApplyResult = {
  response: string;
  usedSkill: "yes" | "no" | "partial";
};

export async function applySkill(args: {
  body: string;
  userPrompt: string;
}): Promise<ApplyResult> {
  const client = getClient();
  const response = await client.messages.create({
    model: "claude-opus-4-8",
    max_tokens: 1500,
    thinking: { type: "adaptive" },
    output_config: { effort: "medium" },
    system: [
      {
        type: "text",
        text: APPLY_SYSTEM_PREAMBLE + args.body,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [{ role: "user", content: args.userPrompt }],
  });

  const text = collectText(response);
  const usedSkill = inferSkillUsage(text, args.body);
  return { response: text, usedSkill };
}

// ---------------------------------------------------------------------------
// Description sharpener
// ---------------------------------------------------------------------------

const SHARPEN_SYSTEM = `You critique Claude Code skill descriptions and propose sharper versions.

A great description specifies:
- Project context (file extensions like .tsx / .vue / .py, frameworks like Next.js, Vue, Nuxt)
- Trigger phrase examples in quotes ("how do I X", "convert Y to Z")
- Negative examples ("do NOT use when...")
- Concrete user-intent matches, not just a topic label

A poor description is short, generic, or just rephrases the title.

Read the current description and the body. Return ONLY the JSON specified by the output schema:
- "suggestion": a sharpened description (120-400 chars). It should preserve the skill's intent but add the missing trigger detail.
- "critique": one sentence naming what was vague or missing.

Do NOT add prose, markdown, or explanation outside the JSON.`;

export type SharpenResult = {
  suggestion: string;
  critique: string;
};

export async function sharpenDescription(args: {
  description: string;
  body: string;
}): Promise<SharpenResult> {
  const client = getClient();
  const response = await client.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 800,
    system: [
      {
        type: "text",
        text: SHARPEN_SYSTEM,
        cache_control: { type: "ephemeral" },
      },
    ],
    output_config: {
      format: {
        type: "json_schema",
        schema: {
          type: "object",
          properties: {
            suggestion: {
              type: "string",
              description: "Sharpened description, 120-400 characters.",
            },
            critique: {
              type: "string",
              description: "One sentence naming what was vague.",
            },
          },
          required: ["suggestion", "critique"],
          additionalProperties: false,
        },
      },
    },
    messages: [
      {
        role: "user",
        content: `CURRENT DESCRIPTION:\n"""\n${args.description}\n"""\n\nSKILL BODY (for context):\n"""\n${args.body.slice(0, 4000)}\n"""`,
      },
    ],
  });

  return parseFirstJson<SharpenResult>(response);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function collectText(response: Anthropic.Message): string {
  return response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
}

function parseFirstJson<T>(response: Anthropic.Message): T {
  const text = collectText(response).trim();
  // Strip ```json fences if the model added them despite output_config.format
  const stripped = text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();
  try {
    return JSON.parse(stripped) as T;
  } catch (err) {
    throw new InvalidResponseError(
      `Could not parse JSON from model response: ${(err as Error).message}\nRaw: ${text.slice(0, 400)}`,
    );
  }
}

export class InvalidResponseError extends Error {
  readonly code = "invalid_response" as const;
}

/**
 * Heuristic: did the model's response actually use the skill?
 * We sample distinctive 6+ word phrases from the body and check overlap.
 * Not perfect, but a useful "did the skill get applied" signal in the UI.
 */
function inferSkillUsage(responseText: string, body: string): ApplyResult["usedSkill"] {
  const normalize = (s: string) =>
    s
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();

  const responseNorm = normalize(responseText);
  const bodyNorm = normalize(body);
  const bodyTokens = bodyNorm.split(" ");

  let matches = 0;
  let probes = 0;
  // Sample 6-grams from the body — anything more specific than common English
  for (let i = 0; i + 6 <= bodyTokens.length; i += 12) {
    const ngram = bodyTokens.slice(i, i + 6).join(" ");
    if (ngram.length < 30) continue;
    probes += 1;
    if (responseNorm.includes(ngram)) matches += 1;
  }

  if (probes === 0) return "partial";
  const ratio = matches / probes;
  if (ratio >= 0.15) return "yes";
  if (ratio > 0) return "partial";
  return "no";
}

// Public: API routes use these to surface stable error codes
export function errorCode(err: unknown): string {
  if (err instanceof MissingApiKeyError) return "missing_api_key";
  if (err instanceof InvalidResponseError) return "invalid_response";
  if (err instanceof Anthropic.AuthenticationError) return "invalid_api_key";
  if (err instanceof Anthropic.RateLimitError) return "rate_limited";
  if (err instanceof Anthropic.BadRequestError) return "bad_request";
  if (err instanceof Anthropic.APIError) return `api_error_${err.status ?? "unknown"}`;
  return "unknown_error";
}
