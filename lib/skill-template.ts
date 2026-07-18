import yaml from "js-yaml";
import type {
  AnnotationKind,
  Lesson,
  LessonCode,
  LessonAnnotation,
  LangKey,
} from "./lessons/types";
import { ANNOTATION_KIND_LABEL, LANG_LABELS } from "./lessons/types";

export type SkillDraft = {
  name: string;
  description: string;
  body: string;
};

export type AnnotationSkillInput = {
  lessonSlug: string;
  lessonTitle: string;
  lang: LangKey;
  shikiLang: string;
  annotationId: string;
  kind: AnnotationKind;
  tip: string;
  remember: string;
  body: string;
  detail?: string;
  codeSnippet: string;
};

export function generateAnnotationSkillDraft(input: AnnotationSkillInput): SkillDraft {
  const langLabel = LANG_LABELS[input.lang];
  const kindLabel = ANNOTATION_KIND_LABEL[input.kind];
  const headline =
    input.remember || input.tip || `${langLabel} pattern: ${input.annotationId}`;

  const name = slugifyName(`${input.lang}-${input.annotationId}`);
  const description = composeAnnotationDescription({ ...input, headline, kindLabel, langLabel });
  const body = composeAnnotationBody({ ...input, headline, kindLabel, langLabel });
  return { name, description, body };
}

function composeAnnotationDescription(input: AnnotationSkillInput & {
  headline: string;
  kindLabel: string;
  langLabel: string;
}): string {
  const triggerPhrases = annotationTriggerPhrases(input).join(", ");
  return [
    `${input.langLabel} ${input.kindLabel.toLowerCase()}: ${input.headline}`,
    `Use whenever the user is writing ${input.langLabel} code that touches this pattern.`,
    triggerPhrases ? `Trigger phrases: ${triggerPhrases}.` : "",
    `Collapse concept: ${input.lessonSlug}.`,
  ]
    .filter(Boolean)
    .join(" ");
}

/**
 * Compose the ≤5 quoted trigger phrases for an annotation-derived artifact,
 * from the annotation's tip, remember, and `lang + annotationId`.
 *
 * Exported (additively) so the MCP template engine (`lib/mcp-template.ts`) can
 * derive a tool's name/description from the SAME composition the skill template
 * uses, rather than duplicating it. Behaviour is unchanged for skill drafts.
 */
export function annotationTriggerPhrases(input: AnnotationSkillInput): string[] {
  const phrases = new Set<string>();
  if (input.tip) {
    phrases.add(`"${truncatePhrase(input.tip)}"`);
  }
  if (input.remember) {
    phrases.add(`"${truncatePhrase(input.remember)}"`);
  }
  phrases.add(`"${input.lang} ${input.annotationId.replace(/-/g, " ")}"`);
  return [...phrases].slice(0, 5);
}

/** Truncate a candidate trigger phrase to 70 chars with an ellipsis. Exported for reuse. */
export function truncatePhrase(s: string): string {
  const cleaned = s.replace(/[*`]/g, "").trim();
  return cleaned.length <= 70 ? cleaned : cleaned.slice(0, 67) + "…";
}

function composeAnnotationBody(input: AnnotationSkillInput & {
  headline: string;
  kindLabel: string;
  langLabel: string;
}): string {
  const parts: string[] = [];
  parts.push(`# ${input.langLabel}: ${input.headline}`);
  parts.push("");
  parts.push(`**Kind:** ${input.kindLabel}. From the Collapse lesson \`${input.lessonSlug}\` (${input.lessonTitle}).`);
  parts.push("");

  parts.push("## When to use this");
  parts.push("");
  parts.push(`When writing or reviewing ${input.langLabel} code that touches the pattern below — especially the ${input.kindLabel.toLowerCase()} cases.`);
  parts.push("");

  parts.push("## Recipe");
  parts.push("");
  if (input.tip) {
    parts.push(`> ${input.tip}`);
    parts.push("");
  }
  if (input.remember) {
    parts.push("**Remember:** " + input.remember);
    parts.push("");
  }
  parts.push("```" + input.shikiLang);
  parts.push(input.codeSnippet);
  parts.push("```");
  parts.push("");

  if (input.body) {
    parts.push("## Why this works");
    parts.push("");
    parts.push(input.body);
    parts.push("");
  }

  if (input.detail) {
    parts.push("### Deeper notes & edge cases");
    parts.push("");
    parts.push(input.detail);
    parts.push("");
  }

  parts.push("## What this skill does NOT do");
  parts.push("");
  parts.push(`- Does not pick a framework — only applies once the user has committed to ${input.langLabel}.`);
  parts.push(`- Does not refactor unrelated code.`);
  parts.push("");

  return parts.join("\n");
}

/** Kebab-case a string into a filesystem-safe skill/server name (≤64 chars). Exported for reuse. */
export function slugifyName(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

export function generateSkillDraft(lesson: Lesson): SkillDraft {
  const primaryLang: LangKey = lesson.frontmatter.primary ?? lesson.frontmatter.languages[0] ?? "next";
  const primaryCode = lesson.codes.find((c) => c.lang === primaryLang) ?? lesson.codes[0];

  const description = composeDescription(lesson, primaryLang);
  const body = composeBody(lesson, primaryCode);

  return {
    name: lesson.frontmatter.slug,
    description,
    body,
  };
}

export function renderSkillFile(draft: SkillDraft): string {
  const frontmatter = yaml.dump(
    { name: draft.name, description: draft.description },
    { lineWidth: -1, quotingType: '"', forceQuotes: false },
  );
  return `---\n${frontmatter}---\n\n${draft.body.trimEnd()}\n`;
}

function composeDescription(lesson: Lesson, primaryLang: LangKey): string {
  const langs = lesson.frontmatter.languages.map((l) => LANG_LABELS[l]).join(", ");
  const summary = lesson.frontmatter.summary || `${lesson.frontmatter.title} pattern`;
  const triggerPhrases = buildTriggerPhrases(lesson, primaryLang);
  return [
    summary,
    `Use this skill whenever the user asks about ${lesson.frontmatter.title.toLowerCase()} in ${langs}, or wants help applying the pattern.`,
    triggerPhrases ? `Trigger phrases: ${triggerPhrases}.` : "",
  ]
    .filter(Boolean)
    .join(" ");
}

function buildTriggerPhrases(lesson: Lesson, primaryLang: LangKey): string {
  const title = lesson.frontmatter.title.toLowerCase();
  const phrases = new Set<string>();
  phrases.add(`"${title}"`);
  for (const code of lesson.codes) {
    for (const a of code.annotations) {
      if (a.tip && a.tip.length < 60) {
        phrases.add(`"${a.tip.split(/\s+/).slice(0, 6).join(" ").replace(/\W+$/, "")}"`);
      }
    }
  }
  phrases.add(`"how do I do ${title} in ${LANG_LABELS[primaryLang]}"`);
  return [...phrases].slice(0, 6).join(", ");
}

function composeBody(lesson: Lesson, primaryCode: LessonCode | undefined): string {
  const parts: string[] = [];
  parts.push(`# ${lesson.frontmatter.title}`);
  parts.push("");
  if (lesson.frontmatter.summary) {
    parts.push(lesson.frontmatter.summary);
    parts.push("");
  }

  parts.push("## When to use this");
  parts.push("");
  parts.push(
    `Apply this pattern when working in ${lesson.frontmatter.languages
      .map((l) => LANG_LABELS[l])
      .join(", ")} and you need to express ${lesson.frontmatter.title.toLowerCase()}.`,
  );
  parts.push("");

  if (primaryCode) {
    parts.push("## Recipe");
    parts.push("");
    parts.push(`Recommended approach in ${LANG_LABELS[primaryCode.lang]}.`);
    parts.push("");
    if (primaryCode.title) {
      parts.push(`File: \`${primaryCode.title}\``);
      parts.push("");
    }
    parts.push("```" + primaryCode.shikiLang);
    parts.push(primaryCode.code.trimEnd());
    parts.push("```");
    parts.push("");
  }

  const whyLines = collectWhyLines(primaryCode);
  if (whyLines.length > 0) {
    parts.push("## Why this works");
    parts.push("");
    for (const line of whyLines) parts.push(`- ${line}`);
    parts.push("");
  }

  const crossLanguage = collectCrossLanguage(lesson, primaryCode);
  if (crossLanguage.length > 0) {
    parts.push("## Cross-language equivalents");
    parts.push("");
    for (const line of crossLanguage) parts.push(`- ${line}`);
    parts.push("");
  }

  parts.push("## What this skill does NOT do");
  parts.push("");
  parts.push("- Does not pick a framework for the user; only applies once they have committed to one of the supported stacks.");
  parts.push("- Does not refactor unrelated code in the file.");
  parts.push("");

  return parts.join("\n");
}

function collectWhyLines(code: LessonCode | undefined): string[] {
  if (!code) return [];
  const out: string[] = [];
  for (const a of code.annotations) {
    out.push(annotationToLine(a));
  }
  return out.filter(Boolean);
}

function annotationToLine(a: LessonAnnotation): string {
  const tip = (a.tip ?? "").trim();
  const body = (a.body ?? "").trim();
  if (tip && body) return `**${tip.replace(/\*/g, "")}** — ${truncate(body, 240)}`;
  if (tip) return tip;
  if (body) return truncate(body, 240);
  return "";
}

function collectCrossLanguage(lesson: Lesson, primary: LessonCode | undefined): string[] {
  const out: string[] = [];
  for (const code of lesson.codes) {
    if (primary && code.lang === primary.lang) continue;
    const firstTip = code.annotations.find((a) => a.tip)?.tip;
    if (firstTip) {
      out.push(`**${LANG_LABELS[code.lang]}:** ${firstTip}`);
    } else if (code.title) {
      out.push(`**${LANG_LABELS[code.lang]}:** see \`${code.title}\``);
    } else {
      out.push(`**${LANG_LABELS[code.lang]}:** included in lesson`);
    }
  }
  return out;
}

function truncate(s: string, n: number): string {
  if (s.length <= n) return s;
  return s.slice(0, n - 1).trimEnd() + "…";
}
