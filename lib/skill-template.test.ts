import { describe, expect, it } from "vitest";
import yaml from "js-yaml";
import {
  generateAnnotationSkillDraft,
  generateSkillDraft,
  renderSkillFile,
  type AnnotationSkillInput,
} from "./skill-template";
import type { Lesson } from "./lessons/types";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function annotationInput(
  overrides: Partial<AnnotationSkillInput> = {},
): AnnotationSkillInput {
  return {
    lessonSlug: "quantum-teleportation",
    lessonTitle: "Quantum teleportation",
    lang: "qiskit",
    shikiLang: "python",
    annotationId: "bell-pair",
    kind: "core",
    tip: "qc.h(0) then qc.cx(0,1) makes a Bell pair",
    remember: "H then CX = entangle",
    body: "The Hadamard creates superposition; the CNOT entangles the two qubits.",
    detail: "Measurement outcomes are perfectly correlated in the noiseless limit.",
    codeSnippet: "qc = QuantumCircuit(2, 2)\nqc.h(0)\nqc.cx(0, 1)",
    ...overrides,
  };
}

function multiLangLesson(): Lesson {
  return {
    frontmatter: {
      slug: "reactive-state",
      title: "Reactive state",
      summary: "How to hold and update reactive state.",
      category: "fundamentals",
      languages: ["next", "vue", "nuxt"],
      primary: "next",
    },
    source: "<mdx source>",
    codes: [
      {
        lang: "next",
        shikiLang: "tsx",
        title: "counter.tsx",
        code: "const [n, setN] = useState(0)",
        meta: "",
        annotations: [
          {
            id: "usestate",
            kind: "core",
            tip: "useState returns a tuple",
            remember: "",
            body: "The setter triggers a re-render.",
            bodyMdx: "",
            detail: "",
          },
        ],
      },
      {
        lang: "vue",
        shikiLang: "vue",
        title: "Counter.vue",
        code: "const n = ref(0)",
        meta: "",
        annotations: [
          {
            id: "ref",
            kind: "core",
            tip: "ref wraps a value in a reactive box",
            remember: "",
            body: "Access the inner value with .value.",
            bodyMdx: "",
            detail: "",
          },
        ],
      },
      {
        lang: "nuxt",
        shikiLang: "vue",
        title: "counter.vue",
        code: "const n = ref(0)",
        meta: "",
        annotations: [],
      },
    ],
  };
}

/** Count individually-quoted phrases inside the "Trigger phrases: …" clause. */
function triggerPhrases(description: string): string[] {
  const m = /Trigger phrases: (.+?)\.\s+Collapse concept:/.exec(description);
  if (!m) return [];
  return m[1].match(/"[^"]*"/g) ?? [];
}

// ---------------------------------------------------------------------------
// generateAnnotationSkillDraft
// ---------------------------------------------------------------------------

describe("generateAnnotationSkillDraft", () => {
  it("derives a kebab-case name from lang + annotationId", () => {
    const draft = generateAnnotationSkillDraft(annotationInput());
    expect(draft.name).toBe("qiskit-bell-pair");
  });

  it("composes the full trigger description (golden)", () => {
    const draft = generateAnnotationSkillDraft(annotationInput());
    expect(draft.description).toBe(
      'Qiskit core concept: H then CX = entangle ' +
        'Use whenever the user is writing Qiskit code that touches this pattern. ' +
        'Trigger phrases: "qc.h(0) then qc.cx(0,1) makes a Bell pair", "H then CX = entangle", "qiskit bell pair". ' +
        'Collapse concept: quantum-teleportation.',
    );
  });

  it("derives trigger phrases from tip, remember, and lang + annotationId", () => {
    const draft = generateAnnotationSkillDraft(annotationInput());
    const phrases = triggerPhrases(draft.description);
    expect(phrases).toContain('"qc.h(0) then qc.cx(0,1) makes a Bell pair"');
    expect(phrases).toContain('"H then CX = entangle"');
    expect(phrases).toContain('"qiskit bell pair"');
  });

  it("keeps the description to at most 5 trigger phrases", () => {
    const draft = generateAnnotationSkillDraft(annotationInput());
    expect(triggerPhrases(draft.description).length).toBeLessThanOrEqual(5);
  });

  it("dedupes an identical tip and remember into a single phrase", () => {
    const draft = generateAnnotationSkillDraft(
      annotationInput({ tip: "same phrase", remember: "same phrase" }),
    );
    const phrases = triggerPhrases(draft.description);
    expect(phrases.filter((p) => p === '"same phrase"')).toHaveLength(1);
  });

  it("truncates trigger phrases longer than 70 chars with an ellipsis", () => {
    const longTip =
      "this trigger phrase is deliberately far longer than seventy characters so it must be truncated";
    const draft = generateAnnotationSkillDraft(
      annotationInput({ tip: longTip, remember: "" }),
    );
    const truncated = longTip.slice(0, 67) + "…";
    expect(draft.description).toContain(`"${truncated}"`);
  });

  it("falls back to a synthetic headline when tip and remember are empty", () => {
    const draft = generateAnnotationSkillDraft(
      annotationInput({ tip: "", remember: "" }),
    );
    expect(draft.description).toContain("Qiskit core concept: Qiskit pattern: bell-pair");
    // only the lang + annotationId phrase survives
    expect(triggerPhrases(draft.description)).toEqual(['"qiskit bell pair"']);
  });

  it("composes the full body (golden)", () => {
    const draft = generateAnnotationSkillDraft(annotationInput());
    const expected = [
      "# Qiskit: H then CX = entangle",
      "",
      "**Kind:** Core concept. From the Collapse lesson `quantum-teleportation` (Quantum teleportation).",
      "",
      "## When to use this",
      "",
      "When writing or reviewing Qiskit code that touches the pattern below — especially the core concept cases.",
      "",
      "## Recipe",
      "",
      "> qc.h(0) then qc.cx(0,1) makes a Bell pair",
      "",
      "**Remember:** H then CX = entangle",
      "",
      "```python",
      "qc = QuantumCircuit(2, 2)",
      "qc.h(0)",
      "qc.cx(0, 1)",
      "```",
      "",
      "## Why this works",
      "",
      "The Hadamard creates superposition; the CNOT entangles the two qubits.",
      "",
      "### Deeper notes & edge cases",
      "",
      "Measurement outcomes are perfectly correlated in the noiseless limit.",
      "",
      "## What this skill does NOT do",
      "",
      "- Does not pick a framework — only applies once the user has committed to Qiskit.",
      "- Does not refactor unrelated code.",
      "",
    ].join("\n");
    expect(draft.body).toBe(expected);
  });

  it("omits optional body/detail sections when absent", () => {
    const draft = generateAnnotationSkillDraft(
      annotationInput({ body: "", detail: undefined }),
    );
    expect(draft.body).not.toContain("## Why this works");
    expect(draft.body).not.toContain("### Deeper notes & edge cases");
    // the code fence still lands
    expect(draft.body).toContain("```python");
  });
});

// ---------------------------------------------------------------------------
// generateSkillDraft
// ---------------------------------------------------------------------------

describe("generateSkillDraft", () => {
  it("uses the lesson slug as the skill name", () => {
    const draft = generateSkillDraft(multiLangLesson());
    expect(draft.name).toBe("reactive-state");
  });

  it("composes the description with summary + language list + trigger phrases (golden)", () => {
    const draft = generateSkillDraft(multiLangLesson());
    expect(draft.description).toBe(
      "How to hold and update reactive state. " +
        "Use this skill whenever the user asks about reactive state in Next.js, Vue, Nuxt, or wants help applying the pattern. " +
        'Trigger phrases: "reactive state", "useState returns a tuple", "ref wraps a value in a", "how do I do reactive state in Next.js".',
    );
  });

  it("populates cross-language equivalents from sibling LangTab blocks", () => {
    const draft = generateSkillDraft(multiLangLesson());
    expect(draft.body).toContain("## Cross-language equivalents");
    // sibling Vue block contributes its first annotation tip
    expect(draft.body).toContain("- **Vue:** ref wraps a value in a reactive box");
    // sibling Nuxt block (no annotations) falls back to its file title
    expect(draft.body).toContain("- **Nuxt:** see `counter.vue`");
    // the primary (Next.js) block is NOT listed as a cross-language equivalent
    const crossSection = draft.body.slice(draft.body.indexOf("## Cross-language equivalents"));
    expect(crossSection).not.toContain("**Next.js:**");
  });

  it("composes the full body (golden)", () => {
    const draft = generateSkillDraft(multiLangLesson());
    const expected = [
      "# Reactive state",
      "",
      "How to hold and update reactive state.",
      "",
      "## When to use this",
      "",
      "Apply this pattern when working in Next.js, Vue, Nuxt and you need to express reactive state.",
      "",
      "## Recipe",
      "",
      "Recommended approach in Next.js.",
      "",
      "File: `counter.tsx`",
      "",
      "```tsx",
      "const [n, setN] = useState(0)",
      "```",
      "",
      "## Why this works",
      "",
      "- **useState returns a tuple** — The setter triggers a re-render.",
      "",
      "## Cross-language equivalents",
      "",
      "- **Vue:** ref wraps a value in a reactive box",
      "- **Nuxt:** see `counter.vue`",
      "",
      "## What this skill does NOT do",
      "",
      "- Does not pick a framework for the user; only applies once they have committed to one of the supported stacks.",
      "- Does not refactor unrelated code in the file.",
      "",
    ].join("\n");
    expect(draft.body).toBe(expected);
  });

  it("falls back to the first language when no primary is set", () => {
    const lesson = multiLangLesson();
    delete lesson.frontmatter.primary;
    const draft = generateSkillDraft(lesson);
    // languages[0] is "next" → recipe recommends Next.js
    expect(draft.body).toContain("Recommended approach in Next.js.");
  });
});

// ---------------------------------------------------------------------------
// renderSkillFile
// ---------------------------------------------------------------------------

describe("renderSkillFile", () => {
  it("emits YAML frontmatter followed by the trimmed body", () => {
    const draft = generateAnnotationSkillDraft(annotationInput());
    const file = renderSkillFile(draft);
    expect(file.startsWith("---\n")).toBe(true);
    expect(file.endsWith(draft.body.trimEnd() + "\n")).toBe(true);
    // blank line separates frontmatter from the body
    expect(file).toContain("\n---\n\n");
  });

  it("round-trips the frontmatter name and description via js-yaml", () => {
    const draft = generateAnnotationSkillDraft(annotationInput());
    const file = renderSkillFile(draft);
    const m = /^---\n([\s\S]*?)---\n\n/.exec(file);
    expect(m).not.toBeNull();
    const parsed = yaml.load(m![1]) as { name: string; description: string };
    expect(parsed.name).toBe(draft.name);
    expect(parsed.description).toBe(draft.description);
  });

  it("keeps a long description unwrapped on one line (js-yaml lineWidth: -1)", () => {
    const draft = generateAnnotationSkillDraft(annotationInput());
    // description is well past the default 80-col fold width
    expect(draft.description.length).toBeGreaterThan(80);
    const file = renderSkillFile(draft);
    const m = /^---\n([\s\S]*?)---\n\n/.exec(file);
    const frontmatterLines = m![1].split("\n").filter((l) => l.length > 0);
    // exactly two keys, one line each — no folded continuation lines
    expect(frontmatterLines).toHaveLength(2);
    expect(frontmatterLines[0].startsWith("name:")).toBe(true);
    expect(frontmatterLines[1].startsWith("description:")).toBe(true);
  });
});
