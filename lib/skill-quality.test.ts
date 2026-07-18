import { describe, expect, it } from "vitest";
import {
  lintDraft,
  qualityVerdict,
  type LintInput,
  type LintIssue,
} from "./skill-quality";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

// A description that clears every check: >=120 chars, a quoted trigger phrase,
// and a stack-specific signal (React / .tsx). Does not begin with the name.
const CLEAN_DESCRIPTION =
  'Use this skill whenever the user is writing React code in a .tsx file and asks ' +
  '"how do I manage local state" or wants help applying the useState pattern to a component.';

// A body that clears every check: >=200 chars, a fenced code block, and all
// four canonical sections.
const CLEAN_BODY = [
  "# State management",
  "",
  "## When to use this",
  "When you need state local to a single React component that survives re-renders.",
  "",
  "## Recipe",
  "Reach for the useState hook and destructure the value and its setter.",
  "",
  "```tsx",
  "const [count, setCount] = useState(0);",
  "```",
  "",
  "## Why this works",
  "Calling the setter schedules a re-render with the next value.",
  "",
  "## What this skill does NOT do",
  "- Does not manage cross-component global state.",
].join("\n");

function draft(overrides: Partial<LintInput> = {}): LintInput {
  return {
    name: "state-management",
    description: CLEAN_DESCRIPTION,
    body: CLEAN_BODY,
    ...overrides,
  };
}

function ids(issues: LintIssue[]): string[] {
  return issues.map((i) => i.id);
}

function issue(id: string, issues: LintIssue[]): LintIssue | undefined {
  return issues.find((i) => i.id === id);
}

// ---------------------------------------------------------------------------
// Clean baseline
// ---------------------------------------------------------------------------

describe("lintDraft — clean baseline", () => {
  it("returns no issues for a well-formed draft", () => {
    expect(lintDraft(draft())).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Description rules
// ---------------------------------------------------------------------------

describe("lintDraft — description rules", () => {
  it("flags an empty description as warn and skips the other description checks", () => {
    const issues = lintDraft(draft({ description: "" }));
    const found = issue("description-empty", issues);
    expect(found?.severity).toBe("warn");
    expect(found?.field).toBe("description");
    // the other description-specific rules do not also fire
    expect(ids(issues)).not.toContain("description-short");
    expect(ids(issues)).not.toContain("description-no-triggers");
  });

  it("flags a short description (<120 chars) as warn", () => {
    // short, but still has a trigger phrase + context so ONLY length fires
    const issues = lintDraft(draft({ description: '"how do I" in a .tsx React file' }));
    expect(issue("description-short", issues)?.severity).toBe("warn");
    expect(ids(issues)).not.toContain("description-no-triggers");
    expect(ids(issues)).not.toContain("description-no-context");
  });

  it("flags a description with no trigger phrases as warn", () => {
    const description =
      "This is a long description about React and TypeScript patterns that goes " +
      "well beyond the minimum length but contains no quoted routing examples at all.";
    const issues = lintDraft(draft({ description }));
    expect(issue("description-no-triggers", issues)?.severity).toBe("warn");
    expect(ids(issues)).not.toContain("description-short");
    expect(ids(issues)).not.toContain("description-no-context");
  });

  it("accepts unquoted trigger signals like 'use whenever' and 'when the user'", () => {
    const withWhenever = lintDraft(
      draft({
        description:
          "Use whenever the user is styling a React component and needs the .tsx pattern " +
          "applied consistently across the whole tree without extra ceremony here.",
      }),
    );
    expect(ids(withWhenever)).not.toContain("description-no-triggers");
  });

  it("flags a description that starts with the skill name as info", () => {
    const description =
      'State management in React: use "how do I" style triggers when writing a .tsx ' +
      "component and you need local state that persists across renders reliably.";
    const issues = lintDraft(draft({ name: "state-management", description }));
    expect(issue("description-repeats-name", issues)?.severity).toBe("info");
    expect(ids(issues)).not.toContain("description-short");
    expect(ids(issues)).not.toContain("description-no-triggers");
    expect(ids(issues)).not.toContain("description-no-context");
  });

  it("does not flag repeats-name when no name is supplied", () => {
    const description =
      'State management in React: use "how do I" style triggers when writing a .tsx ' +
      "component and you need local state that persists across renders reliably.";
    const issues = lintDraft({ description, body: CLEAN_BODY });
    expect(ids(issues)).not.toContain("description-repeats-name");
  });

  it("flags a description with no stack/context signal as info", () => {
    const description =
      'Use this skill whenever the user asks "how do I hold a value that updates" and ' +
      "wants the pattern applied cleanly across the whole component tree here today.";
    const issues = lintDraft(draft({ description }));
    expect(issue("description-no-context", issues)?.severity).toBe("info");
    expect(ids(issues)).not.toContain("description-short");
    expect(ids(issues)).not.toContain("description-no-triggers");
  });
});

// ---------------------------------------------------------------------------
// Body rules
// ---------------------------------------------------------------------------

describe("lintDraft — body rules", () => {
  it("flags an empty body as warn and skips the other body checks", () => {
    const issues = lintDraft(draft({ body: "" }));
    expect(issue("body-empty", issues)?.severity).toBe("warn");
    expect(ids(issues)).not.toContain("body-short");
    expect(ids(issues)).not.toContain("body-no-code");
  });

  it("flags a short body (<200 chars) as warn", () => {
    const issues = lintDraft(draft({ body: "```tsx\nconst x = 1;\n```" }));
    expect(issue("body-short", issues)?.severity).toBe("warn");
    // has a code fence, so no-code does not fire
    expect(ids(issues)).not.toContain("body-no-code");
  });

  it("flags a body with no fenced code block as warn", () => {
    const body = [
      "# Prose only",
      "",
      "## When to use this",
      "This section is deliberately long enough to clear the two-hundred character floor so",
      "that the body-short rule does not fire and we isolate the missing code fence instead.",
      "",
      "## Recipe",
      "Describe the steps in words but never show a runnable snippet in a fenced block.",
      "",
      "## Why this works",
      "Because the prose explains the reasoning without any code at all here.",
    ].join("\n");
    const issues = lintDraft(draft({ body }));
    expect(issue("body-no-code", issues)?.severity).toBe("warn");
    expect(ids(issues)).not.toContain("body-short");
    expect(ids(issues)).not.toContain("body-missing-sections");
  });

  it("flags a body missing canonical sections as info", () => {
    const body = [
      "# Sparse body",
      "",
      "## Recipe",
      "This body has a fenced code block and enough characters to clear the length floor,",
      "but it only uses a single canonical heading so the structure suggestion should fire.",
      "",
      "```tsx",
      "const [count, setCount] = useState(0);",
      "```",
    ].join("\n");
    const issues = lintDraft(draft({ body }));
    expect(issue("body-missing-sections", issues)?.severity).toBe("info");
    expect(ids(issues)).not.toContain("body-short");
    expect(ids(issues)).not.toContain("body-no-code");
  });
});

// ---------------------------------------------------------------------------
// qualityVerdict
// ---------------------------------------------------------------------------

describe("qualityVerdict", () => {
  it("returns clean for no issues", () => {
    expect(qualityVerdict([])).toBe("clean");
    expect(qualityVerdict(lintDraft(draft()))).toBe("clean");
  });

  it("returns info when only info-level issues are present", () => {
    const infoOnly: LintIssue[] = [
      { id: "x", field: "description", severity: "info", message: "" },
      { id: "y", field: "body", severity: "info", message: "" },
    ];
    expect(qualityVerdict(infoOnly)).toBe("info");
    // a description that only repeats its name is info-only
    const description =
      'State management in React: use "how do I" style triggers when writing a .tsx ' +
      "component and you need local state that persists across renders reliably.";
    expect(qualityVerdict(lintDraft(draft({ description })))).toBe("info");
  });

  it("returns warn when any warn-level issue is present, regardless of infos", () => {
    const mixed: LintIssue[] = [
      { id: "a", field: "body", severity: "info", message: "" },
      { id: "b", field: "description", severity: "warn", message: "" },
    ];
    expect(qualityVerdict(mixed)).toBe("warn");
    expect(qualityVerdict(lintDraft(draft({ description: "" })))).toBe("warn");
  });
});
