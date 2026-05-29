# Build your own ingestor

An ingestor turns *some kind of source material* into a `AnnotationSkillInput` that Collapse's template engine knows how to consume. Once you have an `AnnotationSkillInput`, you get the full skill-export pipeline for free — collision detection, atomic writes, frontmatter, trigger-phrase generation, the whole thing.

This walkthrough uses **a blog-post ingestor** as the running example. You want to turn a markdown article (your own, someone else's) into a skill: pick a code block, write a note, collapse.

## The contract

```ts
import type { AnnotationSkillInput } from "@/lib/skill-template";
```

That's the boundary. Produce one of those, hand it to `generateAnnotationSkillDraft()`, POST the result to `/api/skills`.

Here's the shape (see `lib/skill-template.ts`):

```ts
type AnnotationSkillInput = {
  lessonSlug: string;       // kebab-case identifier for the source
  lessonTitle: string;      // human-readable title
  lang: LangKey;            // "next" | "vue" | "nuxt" | "qiskit"
  shikiLang: string;        // Shiki lang token: "tsx" | "vue" | "python" …
  annotationId: string;     // kebab-case id for this specific annotation
  kind: AnnotationKind;     // "core" | "note" | "gotcha" | "mistake" | "mnemonic" | "cross"
  tip: string;              // one-line "why this matters"
  remember: string;         // optional mnemonic
  body: string;             // why the pattern works, plain prose
  detail?: string;          // optional deeper notes
  codeSnippet: string;      // the code itself
};
```

## The blog-post ingestor in four files

Mirroring `lib/notebook/`:

### 1. `lib/blog/types.ts`

```ts
export type BlogPost = {
  slug: string;
  title: string;
  language: string;       // "typescript" | "python" | …
  bodyMarkdown: string;
};

export type BlogCodeBlock = {
  lang?: string;
  source: string;
  /** Markdown text immediately before this block. Useful for prefilling notes. */
  precedingProse: string;
};
```

### 2. `lib/blog/parse.ts`

```ts
import type { BlogPost, BlogCodeBlock } from "./types";

const FENCE = /^```(\w+)?\s*\n([\s\S]*?)\n```/gm;

export function parseBlogPost(raw: string): {
  post: BlogPost;
  blocks: BlogCodeBlock[];
} {
  const { data, content } = parseFrontmatter(raw); // use gray-matter or similar
  const post: BlogPost = {
    slug: data.slug ?? slugify(data.title ?? "untitled"),
    title: data.title ?? "Untitled",
    language: data.language ?? "typescript",
    bodyMarkdown: content,
  };

  const blocks: BlogCodeBlock[] = [];
  let cursor = 0;
  let m: RegExpExecArray | null;
  FENCE.lastIndex = 0;
  while ((m = FENCE.exec(content))) {
    blocks.push({
      lang: m[1],
      source: m[2],
      precedingProse: content.slice(cursor, m.index).trim(),
    });
    cursor = m.index + m[0].length;
  }
  return { post, blocks };
}
```

Borrow the fence regex idea from `lib/notebook/parse-myst.ts`. The shape `(post, blocks)` mirrors `(notebook, cells)`.

### 3. `lib/blog/to-annotation-input.ts`

```ts
import type { AnnotationSkillInput } from "@/lib/skill-template";
import type { AnnotationKind, LangKey } from "@/lib/lessons/types";
import { LANG_SHIKI } from "@/lib/lessons/types";

type BuildArgs = {
  post: BlogPost;
  block: BlogCodeBlock;
  lang: LangKey;
  annotation: {
    id: string;
    kind: AnnotationKind;
    tip: string;
    remember: string;
    body: string;
    detail?: string;
  };
};

export function toAnnotationSkillInput(args: BuildArgs): AnnotationSkillInput {
  return {
    lessonSlug: args.post.slug,
    lessonTitle: args.post.title,
    lang: args.lang,
    shikiLang: LANG_SHIKI[args.lang],
    annotationId: args.annotation.id,
    kind: args.annotation.kind,
    tip: args.annotation.tip,
    remember: args.annotation.remember,
    body: args.annotation.body,
    detail: args.annotation.detail,
    codeSnippet: args.block.source.trimEnd(),
  };
}
```

Identical shape to `lib/notebook/to-annotation-input.ts`. The mapping is mechanical.

### 4. `lib/blog/extract-headings.ts` *(optional, for prefilling)*

The notebook ingestor pre-fills the annotation form from MyST admonitions in nearby markdown cells. Your blog ingestor might pre-fill from headings, callout syntax, or anything else in `precedingProse`. This file lives in the same shape as `lib/notebook/extract-admonitions.ts`.

## Wire it up

Your new ingestor's UI is whatever you want. The minimum is:

```ts
import { parseBlogPost } from "@/lib/blog/parse";
import { toAnnotationSkillInput } from "@/lib/blog/to-annotation-input";
import { generateAnnotationSkillDraft } from "@/lib/skill-template";

const { post, blocks } = parseBlogPost(rawMarkdown);
const input = toAnnotationSkillInput({
  post,
  block: blocks[selectedIdx],
  lang: "next",
  annotation: { id, kind, tip, remember, body },
});
const draft = generateAnnotationSkillDraft(input);

await fetch("/api/skills", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify(draft),
});
```

That's the whole flow. The template engine handles `name`, `description`, `body`, frontmatter, atomic write, 409-on-collision. None of that is your problem.

## Tests

Mirror the notebook ingestor's test discipline: one `vitest` file per parser/extractor, no UI tests, no engine tests. The blog ingestor can ship in <250 lines of code + ~150 lines of tests.

## Checklist for a new ingestor

- [ ] Picked a source format with stable parseable structure
- [ ] `lib/<name>/types.ts` — typed parsed shape
- [ ] `lib/<name>/parse-*.ts` — the parser (no I/O — operate on strings)
- [ ] `lib/<name>/to-annotation-input.ts` — the adapter to `AnnotationSkillInput`
- [ ] Optional: extractor(s) for prefilling notes from prose around the code
- [ ] Vitest covering parser edge cases
- [ ] UI surface (route or component) that calls `generateAnnotationSkillDraft` + POSTs to `/api/skills`

If you can do all that, you can extend Collapse to ingest anything: tweets with code, GitHub gists, Stack Overflow answers, conference talk transcripts, ADRs, whatever you find patterns in.
