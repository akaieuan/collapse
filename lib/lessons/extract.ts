import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkMdx from "remark-mdx";
import remarkFrontmatter from "remark-frontmatter";
import { visit } from "unist-util-visit";
import type { Root, Code } from "mdast";
import type { MdxJsxFlowElement, MdxJsxAttribute } from "mdast-util-mdx-jsx";
import { extractAttr, parseAnnotMeta } from "../shiki/parse-meta";
import {
  LANG_SHIKI,
  type AnnotationKind,
  type LangKey,
  type LessonAnnotation,
  type LessonCode,
} from "./types";

type RawNote = {
  id: string;
  kind: AnnotationKind;
  tip: string;
  remember: string;
  bodyMdx: string;
  bodyText: string;
  detail: string;
};

const VALID_KINDS = new Set<AnnotationKind>([
  "note",
  "core",
  "gotcha",
  "mistake",
  "mnemonic",
  "cross",
]);

type LangBucket = {
  lang: LangKey;
  code?: LessonCode;
  notes: RawNote[];
  details: Map<string, { text: string; mdx: string }>;
};

const LANG_FENCE_TO_KEY: Record<string, LangKey> = {
  tsx: "next",
  ts: "next",
  jsx: "next",
  js: "next",
  vue: "vue",
  python: "qiskit",
  py: "qiskit",
};

export function extractLessonCodes(mdxSource: string): LessonCode[] {
  const tree = unified()
    .use(remarkParse)
    .use(remarkFrontmatter, ["yaml"])
    .use(remarkMdx)
    .parse(mdxSource) as Root;

  const buckets = new Map<LangKey, LangBucket>();
  const state = { currentLang: null as LangKey | null };

  const ensureBucket = (lang: LangKey): LangBucket => {
    let bucket = buckets.get(lang);
    if (!bucket) {
      bucket = { lang, notes: [], details: new Map() };
      buckets.set(lang, bucket);
    }
    return bucket;
  };

  type WalkableNode = { type: string; children?: unknown[] } & Record<string, unknown>;

  function walk(nodes: unknown[], inheritedLang: LangKey | null) {
    for (const raw of nodes) {
      const node = raw as WalkableNode;
      if (node.type === "code") {
        const code = node as unknown as Code;
        const fenceLang = (code.lang ?? "").toLowerCase();
        const lang = inheritedLang ?? guessLangKey(fenceLang, code.meta);
        if (!lang) continue;
        state.currentLang = lang;
        const bucket = ensureBucket(lang);
        const meta = code.meta ?? "";
        const title = extractAttr(meta, "title");
        const annotationIds = parseAnnotMeta(meta).map((a) => a.id);
        bucket.code = {
          lang,
          shikiLang: shikiLangForFence(fenceLang) ?? LANG_SHIKI[lang],
          title,
          code: code.value,
          meta,
          annotations: annotationIds.map((id) => ({
            id,
            kind: "note" as AnnotationKind,
            tip: "",
            remember: "",
            body: "",
            bodyMdx: "",
            detail: "",
          })),
        };
      } else if (node.type === "mdxJsxFlowElement") {
        const jsx = node as unknown as MdxJsxFlowElement;
        if (jsx.name === "LangTab") {
          const langAttr = getAttrString(jsx.attributes, "lang");
          const inferred = (langAttr as LangKey | undefined) ?? null;
          if (inferred) state.currentLang = inferred;
          if (jsx.children) walk(jsx.children, inferred ?? inheritedLang);
        } else if (jsx.name === "Concept") {
          if (jsx.children) walk(jsx.children, inheritedLang);
        } else if (jsx.name === "Note") {
          const id = getAttrString(jsx.attributes, "id");
          const tip = getAttrString(jsx.attributes, "tip") ?? "";
          const remember = getAttrString(jsx.attributes, "remember") ?? "";
          const kindAttr = getAttrString(jsx.attributes, "kind") as AnnotationKind | undefined;
          const kind = kindAttr && VALID_KINDS.has(kindAttr) ? kindAttr : "note";
          const noteLangAttr = getAttrString(jsx.attributes, "lang");
          const bucketLang =
            (noteLangAttr as LangKey | undefined) ??
            inheritedLang ??
            state.currentLang;
          if (!id || !bucketLang) continue;
          const bucket = ensureBucket(bucketLang);
          const start = jsx.position?.start.offset ?? 0;
          const end = jsx.position?.end.offset ?? 0;
          const bodyMdx = start && end ? mdxSource.slice(start, end) : "";
          const bodyText = extractTextFromJsx(jsx);
          bucket.notes.push({ id, kind, tip, remember, bodyMdx, bodyText, detail: "" });
        } else if (jsx.name === "Detail") {
          const id = getAttrString(jsx.attributes, "id");
          const detailLangAttr = getAttrString(jsx.attributes, "lang");
          const bucketLang =
            (detailLangAttr as LangKey | undefined) ??
            inheritedLang ??
            state.currentLang;
          if (!id || !bucketLang) continue;
          const bucket = ensureBucket(bucketLang);
          const start = jsx.position?.start.offset ?? 0;
          const end = jsx.position?.end.offset ?? 0;
          const mdx = start && end ? mdxSource.slice(start, end) : "";
          const text = extractDetailText(jsx);
          bucket.details.set(id, { text, mdx });
        } else if (jsx.children) {
          walk(jsx.children, inheritedLang);
        }
      }
    }
  }

  walk(tree.children, null);

  for (const bucket of buckets.values()) {
    if (!bucket.code) continue;
    bucket.code.annotations = bucket.code.annotations.map((a) => {
      const note = bucket.notes.find((n) => n.id === a.id);
      const detail = bucket.details.get(a.id)?.text ?? "";
      return {
        id: a.id,
        kind: note?.kind ?? "note",
        tip: note?.tip ?? "",
        remember: note?.remember ?? "",
        body: note?.bodyText ?? "",
        bodyMdx: note?.bodyMdx ?? "",
        detail,
      };
    });
    const knownIds = new Set(bucket.code.annotations.map((a) => a.id));
    for (const note of bucket.notes) {
      if (!knownIds.has(note.id)) {
        bucket.code.annotations.push({
          id: note.id,
          kind: note.kind,
          tip: note.tip,
          remember: note.remember,
          body: note.bodyText,
          bodyMdx: note.bodyMdx,
          detail: bucket.details.get(note.id)?.text ?? "",
        });
      }
    }
  }

  return [...buckets.values()]
    .map((b) => b.code)
    .filter((c): c is LessonCode => Boolean(c));
}

function guessLangKey(
  fenceLang: string,
  meta: string | null | undefined,
): LangKey | null {
  const lensAttr = extractAttr(meta, "lens");
  if (lensAttr === "next" || lensAttr === "vue" || lensAttr === "nuxt" || lensAttr === "qiskit") {
    return lensAttr;
  }
  return LANG_FENCE_TO_KEY[fenceLang] ?? null;
}

function shikiLangForFence(fenceLang: string): string | undefined {
  if (!fenceLang) return undefined;
  const valid = new Set([
    "tsx",
    "ts",
    "jsx",
    "js",
    "vue",
    "python",
    "py",
    "bash",
    "json",
    "html",
    "css",
  ]);
  return valid.has(fenceLang) ? fenceLang : undefined;
}

function getAttrString(
  attrs: (MdxJsxAttribute | { type: "mdxJsxExpressionAttribute" })[] | undefined,
  name: string,
): string | undefined {
  if (!attrs) return undefined;
  for (const attr of attrs) {
    if (attr.type !== "mdxJsxAttribute") continue;
    if (attr.name !== name) continue;
    if (typeof attr.value === "string") return attr.value;
    if (
      attr.value &&
      typeof attr.value === "object" &&
      "type" in attr.value &&
      attr.value.type === "mdxJsxAttributeValueExpression"
    ) {
      const raw = attr.value.value.trim();
      const stringMatch = raw.match(/^['"`](.*)['"`]$/);
      if (stringMatch) return stringMatch[1];
      return raw;
    }
  }
  return undefined;
}

function extractTextFromJsx(node: MdxJsxFlowElement): string {
  const parts: string[] = [];
  visit(node, (n) => {
    if (n.type === "text") parts.push((n as { value: string }).value);
    if (n.type === "inlineCode") parts.push((n as { value: string }).value);
  });
  return parts.join(" ").replace(/\s+/g, " ").trim();
}

function extractDetailText(node: MdxJsxFlowElement): string {
  // Walk top-level children and preserve structure: paragraphs as text blocks,
  // code blocks as fenced markdown.
  const parts: string[] = [];
  for (const raw of node.children ?? []) {
    const child = raw as { type: string; value?: string; lang?: string; children?: unknown[] };
    if (child.type === "paragraph") {
      const inner: string[] = [];
      visit(child as never, (n) => {
        const nn = n as { type: string; value?: string };
        if (nn.type === "text") inner.push(nn.value ?? "");
        else if (nn.type === "inlineCode") inner.push("`" + (nn.value ?? "") + "`");
        else if (nn.type === "strong") {
          const t: string[] = [];
          visit(n as never, (m) => {
            const mm = m as { type: string; value?: string };
            if (mm.type === "text") t.push(mm.value ?? "");
          });
          inner.push("**" + t.join("") + "**");
        }
      });
      const text = inner.join("").replace(/\s+/g, " ").trim();
      if (text) parts.push(text);
    } else if (child.type === "code") {
      const lang = child.lang ?? "";
      parts.push("```" + lang + "\n" + (child.value ?? "") + "\n```");
    } else if (child.type === "list") {
      const items: string[] = [];
      visit(child as never, (n) => {
        const nn = n as { type: string };
        if (nn.type === "listItem") {
          const itemText: string[] = [];
          visit(n as never, (m) => {
            const mm = m as { type: string; value?: string };
            if (mm.type === "text") itemText.push(mm.value ?? "");
            else if (mm.type === "inlineCode") itemText.push("`" + (mm.value ?? "") + "`");
          });
          const t = itemText.join("").replace(/\s+/g, " ").trim();
          if (t) items.push("- " + t);
        }
      });
      if (items.length) parts.push(items.join("\n"));
    }
  }
  return parts.join("\n\n");
}

export function getPrimaryLessonCode(codes: LessonCode[], primary?: LangKey): LessonCode | undefined {
  if (primary) {
    const match = codes.find((c) => c.lang === primary);
    if (match) return match;
  }
  return codes[0];
}

export function annotationToProse(a: LessonAnnotation): string {
  const cleanedBody = a.body.replace(/\s+/g, " ").trim();
  if (!a.tip) return cleanedBody;
  if (!cleanedBody) return a.tip;
  return `**${a.tip.replace(/\*/g, "")}** — ${cleanedBody}`;
}
