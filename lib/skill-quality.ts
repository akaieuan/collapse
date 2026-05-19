/**
 * Cheap, mechanical quality checks on a skill draft.
 * Surfaced inline next to the description / body fields and on the /skills index.
 *
 * Severity tiers:
 *   - "warn"  — likely to hurt skill discoverability / utility; show in red.
 *   - "info"  — soft suggestions; show in amber.
 *
 * Pure functions. No I/O. No async.
 */

export type LintSeverity = "warn" | "info";
export type LintField = "description" | "body";

export type LintIssue = {
  id: string;
  field: LintField;
  severity: LintSeverity;
  message: string;
};

export type LintInput = {
  name?: string;
  description: string;
  body: string;
};

const CANONICAL_HEADINGS = [
  "## When to use this",
  "## Recipe",
  "## Why this works",
  "## What this skill does NOT do",
] as const;

export function lintDraft(input: LintInput): LintIssue[] {
  const issues: LintIssue[] = [];
  const { description, body, name } = input;

  // -- description checks ------------------------------------------------
  const desc = description.trim();
  if (desc.length === 0) {
    issues.push({
      id: "description-empty",
      field: "description",
      severity: "warn",
      message: "Description is empty — Claude won't know when to trigger this skill.",
    });
  } else {
    if (desc.length < 120) {
      issues.push({
        id: "description-short",
        field: "description",
        severity: "warn",
        message: `Description is ${desc.length} chars. Aim for 120+ to give Claude enough routing signal.`,
      });
    }

    if (!hasTriggerPhrase(desc)) {
      issues.push({
        id: "description-no-triggers",
        field: "description",
        severity: "warn",
        message: 'No trigger phrases detected. Add quoted examples like "how do I X" or "when the user is in a .tsx file".',
      });
    }

    if (name && repeatsName(desc, name)) {
      issues.push({
        id: "description-repeats-name",
        field: "description",
        severity: "info",
        message: "Description starts with the skill name. Lead with WHEN to trigger, not what the skill is called.",
      });
    }

    if (!mentionsContext(desc)) {
      issues.push({
        id: "description-no-context",
        field: "description",
        severity: "info",
        message: "Description doesn't mention a file extension, framework, or language. Add stack-specific signals.",
      });
    }
  }

  // -- body checks -------------------------------------------------------
  const bodyTrim = body.trim();
  if (bodyTrim.length === 0) {
    issues.push({
      id: "body-empty",
      field: "body",
      severity: "warn",
      message: "Body is empty — Claude has nothing to apply when this skill triggers.",
    });
  } else {
    if (bodyTrim.length < 200) {
      issues.push({
        id: "body-short",
        field: "body",
        severity: "warn",
        message: `Body is ${bodyTrim.length} chars. Trivial bodies don't help Claude apply the pattern.`,
      });
    }

    if (!hasFencedCodeBlock(bodyTrim)) {
      issues.push({
        id: "body-no-code",
        field: "body",
        severity: "warn",
        message: "Body has no fenced code block. Skills land better with a working recipe.",
      });
    }

    const headingsFound = CANONICAL_HEADINGS.filter((h) => bodyTrim.includes(h)).length;
    if (headingsFound < 3) {
      issues.push({
        id: "body-missing-sections",
        field: "body",
        severity: "info",
        message: `Body has ${headingsFound}/4 canonical sections (When / Recipe / Why / Not). Structure helps Claude navigate.`,
      });
    }
  }

  return issues;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function hasTriggerPhrase(s: string): boolean {
  // Looks for: quoted strings, "when the user", "trigger phrases", "use whenever", file extensions
  const lower = s.toLowerCase();
  if (/["'"][^"'"]{4,}["'"]/.test(s)) return true;
  if (/when (the user|writing|in a)/.test(lower)) return true;
  if (/use whenever|trigger phrases?|fires when/.test(lower)) return true;
  if (/\.[a-z]{2,4}\b/.test(lower) && /\b(file|extension)\b/.test(lower)) return true;
  return false;
}

function mentionsContext(s: string): boolean {
  const lower = s.toLowerCase();
  // file extensions
  if (/\.(tsx|ts|jsx|js|vue|py|rb|go|rs|java|kt|swift|cs|php|sql|md|yaml|yml|json)\b/.test(lower)) return true;
  // common frameworks/languages
  if (
    /\b(react|next\.?js|vue|nuxt|svelte|qiskit|python|typescript|javascript|tailwind|prisma|django|fastapi|express|node)\b/.test(
      lower,
    )
  ) {
    return true;
  }
  return false;
}

function hasFencedCodeBlock(s: string): boolean {
  return /```[a-z0-9]*\n[\s\S]*?```/i.test(s);
}

function repeatsName(desc: string, name: string): boolean {
  const niceName = name.replace(/-/g, " ").trim().toLowerCase();
  if (niceName.length < 4) return false;
  const start = desc.slice(0, niceName.length + 4).toLowerCase();
  return start.startsWith(niceName);
}

/**
 * Aggregate into a quality verdict for cards / list views.
 * `clean` → no issues, `info` → only info-level, `warn` → at least one warn.
 */
export type QualityVerdict = "clean" | "info" | "warn";

export function qualityVerdict(issues: LintIssue[]): QualityVerdict {
  if (issues.some((i) => i.severity === "warn")) return "warn";
  if (issues.some((i) => i.severity === "info")) return "info";
  return "clean";
}
