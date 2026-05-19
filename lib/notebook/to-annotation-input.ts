import type { AnnotationSkillInput } from "@/lib/skill-template";
import type { AnnotationKind, LangKey } from "@/lib/lessons/types";
import { LANG_SHIKI } from "@/lib/lessons/types";

export type ImportDraftInput = {
  cellSource: string;
  lang: LangKey;
  notebookSlug: string;
  notebookTitle: string;
  annotation: {
    id: string;
    kind: AnnotationKind;
    tip: string;
    remember: string;
    body: string;
    detail?: string;
  };
};

export function toAnnotationSkillInput(input: ImportDraftInput): AnnotationSkillInput {
  return {
    lessonSlug: input.notebookSlug,
    lessonTitle: input.notebookTitle,
    lang: input.lang,
    shikiLang: LANG_SHIKI[input.lang],
    annotationId: input.annotation.id,
    kind: input.annotation.kind,
    tip: input.annotation.tip,
    remember: input.annotation.remember,
    body: input.annotation.body,
    detail: input.annotation.detail,
    codeSnippet: input.cellSource.trimEnd(),
  };
}

const ADMONITION_TO_KIND: Record<string, AnnotationKind> = {
  note: "note",
  tip: "note",
  important: "core",
  attention: "core",
  warning: "gotcha",
  caution: "gotcha",
  danger: "mistake",
  seealso: "cross",
};

export function admonitionToAnnotationKind(admonitionKind: string): AnnotationKind {
  return ADMONITION_TO_KIND[admonitionKind.toLowerCase()] ?? "note";
}
