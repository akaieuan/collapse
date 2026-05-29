# The SKILL.md format

`SKILL.md` is the artifact Collapse writes. Claude Code reads it when it boots a session and uses the `description` field to decide when to load it.

This page documents the shape Collapse currently produces. The full Claude skill spec lives in Anthropic's docs — Collapse generates a strict subset that works reliably.

## Anatomy

```markdown
---
name: <kebab-case-slug>
description: "<one paragraph that Claude reads to decide when to use this>"
---

# <human-readable title>

<one-line frame: what this is, where it came from>

## When to use this
<plain-prose condition>

## Recipe
> <one-line tip the user can scan>
**Remember:** <optional mnemonic>

```<lang>
<code snippet>
```

## Why this works
- **<headline>** — <body, ≤240 chars>
- ...

## Cross-language equivalents
- **<other lang>:** <how the same idea lands there>

### Deeper notes & edge cases
<optional longer prose>

## What this skill does NOT do
- <constraint>
```

## Frontmatter

```yaml
---
name: vue-ref-computed
description: "Vue core concept: ref() boxes a primitive so Vue can track reassignment..."
---
```

**`name`** — kebab-case, ≤64 chars, matches `^[a-z0-9]+(?:-[a-z0-9]+)*$`. Used as the directory name (`~/.claude/skills/{name}/SKILL.md`) and as Claude's primary identifier.

**`description`** — ≤2048 chars. **This is the most important field.** Claude scans descriptions across all skills in your directory and loads the matching skills into context. Three things make a good description:

1. **A first sentence that frames the pattern in domain language.** "Vue core concept: ref() boxes a primitive…" not "this skill helps with reactivity."
2. **An explicit "use whenever…" clause.** Tells Claude when to fire. "Use whenever the user is writing Vue code that touches local reactive state."
3. **Trigger phrases in quotes.** Literal strings Claude will fuzzy-match against user input. Collapse derives these from the `tip` + `remember` + lesson title and packs ≤5 into the description.

Collapse builds all three from your annotation data; no manual description editing required for the common case.

## Body sections

Collapse-generated bodies always include these sections in this order. None are required by Claude — they're a convention that produces consistent, scannable skills.

### `# <title>`

Stack-prefixed by default: `# Vue: ref() boxes a primitive so Vue can track reassignment`. The `:` separator helps Claude recognize the stack.

### `## When to use this`

One short paragraph stating the condition. Comes from the annotation `kind` + lang context.

### `## Recipe`

The canonical code, framed by:
- a `>` blockquote of your `tip` (one-line "why this matters")
- an optional `**Remember:**` mnemonic from your `remember` field
- a fenced `<lang>` code block carrying the `codeSnippet`

### `## Why this works`

Bullet list. Each bullet is `**<tip>** — <body>` from your annotations. The body is truncated at 240 chars; deeper notes go below.

### `## Cross-language equivalents` *(optional)*

Only generated when the source lesson had multiple `<LangTab>` blocks. Pulls the first tip from each other-language `LangTab` and labels it with the language. This is the cross-stack vocabulary that lets Claude answer "how do I do X in [other stack]" correctly even when the source pattern was in one language.

### `### Deeper notes & edge cases` *(optional)*

Annotation `detail` field, untruncated. Use sparingly — long bodies cost Claude tokens.

### `## What this skill does NOT do`

Two bullet points by default:
- "Does not pick a framework — only applies once the user has committed to {lang}."
- "Does not refactor unrelated code."

These guardrails reduce false-positive activation. You can customize them by editing the SKILL.md after generation; they're just markdown.

## Constraints (enforced by Collapse's POST endpoint)

- `name` — `≤64 chars`, kebab-case regex above
- `description` — `1 ≤ len ≤ 2048` chars
- `body` — `1 ≤ len ≤ 50000` chars
- Write target — `~/.claude/skills/{name}/SKILL.md`; any name escaping that root is rejected
- Collision — `409` on existing file unless `overwrite: true` is sent

See `app/api/skills/route.ts` for the Zod schema and the atomic-write logic (`.tmp + rename`).

## Quality verdicts

Collapse's `/skills` page runs each generated file through `lib/skill-quality.ts` and shows one of:

- **`clean`** — no issues
- **`info`** — minor stylistic notes
- **`warn`** — a structural issue (missing field, oversized description, ambiguous trigger phrases)

The linter is conservative. A `warn` doesn't mean Claude can't use the skill — it means the skill is likely to fire incorrectly or get lost in description-matching.

## What Collapse does NOT generate

- **`progressive-disclosure`** keys, multi-step workflows, or branching logic. Generated skills are atomic.
- **Embedded tools** or MCP server hooks. *(See [roadmap.md](roadmap.md) — MCP scaffold output is the planned second target.)*
- **Image / asset references.** Bodies are pure markdown.
- **`when_to_use` lists with explicit code matchers.** Collapse relies on description trigger phrases.

If your use case needs any of those, you'd hand-edit the generated SKILL.md or — better — build an alternative template engine alongside `lib/skill-template.ts`.
