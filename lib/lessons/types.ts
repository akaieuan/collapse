export type LangKey = "next" | "vue" | "nuxt" | "qiskit";

export const LANG_LABELS: Record<LangKey, string> = {
  next: "Next.js",
  vue: "Vue",
  nuxt: "Nuxt",
  qiskit: "Qiskit",
};

export const LANG_SHIKI: Record<LangKey, string> = {
  next: "tsx",
  vue: "vue",
  nuxt: "vue",
  qiskit: "python",
};

export type AnnotationKind =
  | "note"
  | "core"
  | "gotcha"
  | "mistake"
  | "mnemonic"
  | "cross";

export const ANNOTATION_KIND_LABEL: Record<AnnotationKind, string> = {
  note: "Note",
  core: "Core concept",
  gotcha: "Gotcha",
  mistake: "Common mistake",
  mnemonic: "Memory hook",
  cross: "Cross-language",
};

export type LessonAnnotation = {
  id: string;
  kind: AnnotationKind;
  tip: string;
  remember: string;
  body: string;
  bodyMdx: string;
  detail: string;
};

export type LessonCode = {
  lang: LangKey;
  shikiLang: string;
  title?: string;
  code: string;
  meta: string;
  annotations: LessonAnnotation[];
};

export type LessonFrontmatter = {
  slug: string;
  title: string;
  summary: string;
  category: string;
  languages: LangKey[];
  primary?: LangKey;
  qiskitNote?: string;
};

export type Lesson = {
  frontmatter: LessonFrontmatter;
  source: string;
  codes: LessonCode[];
};

export const ALL_LANGS: LangKey[] = ["next", "vue", "nuxt", "qiskit"];
