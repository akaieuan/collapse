# Architecture

Collapse is a framework with three layers. Every artifact (a Claude skill today, an MCP tool tomorrow) takes the same path through them.

```
┌───────────────────┐    ┌────────────────────────┐    ┌─────────────────┐
│  ingestor         │──▶ │  template engine       │──▶ │  persistence    │
│  (the on-ramps)   │    │  (lib/skill-template)  │    │  (/api/skills)  │
│                   │    │                        │    │                 │
│  · MDX lessons    │    │  generateAnnotation-   │    │  ~/.claude/     │
│  · .ipynb         │    │    SkillDraft()        │    │    skills/      │
│  · MyST .md       │    │  generateSkillDraft()  │    │    {name}/      │
│  · your own ▲     │    │  renderSkillFile()     │    │    SKILL.md     │
└───────────────────┘    └────────────────────────┘    └─────────────────┘
                                                            │
                                                            ▼
                                                     (roadmap: MCP server
                                                      scaffold output)
```

## Layer 1 — Ingestor

An ingestor takes source material and produces a typed `AnnotationSkillInput` for the template engine. It owns the "what does input look like" question and nothing else.

Two ingestors ship in the repo:

- **MDX lessons** (`lib/lessons/`) reads `examples/concepts/*.mdx`, parses the remark-mdx AST, and surfaces code fences + sibling `<Note>` blocks as `LessonCode[]` + `LessonAnnotation[]`. The lesson loader (`lib/lessons/loader.ts`) handles caching and frontmatter.
- **Notebook import** (`lib/notebook/`) reads `.ipynb` JSON or MyST `.md` strings, splits them into a typed `ParsedCell[]`, and runs nearby markdown cells through an admonition extractor. The adapter (`to-annotation-input.ts`) maps `(cell, lang, annotation)` onto `AnnotationSkillInput`.

Both ingestors converge on the same downstream type. The engine doesn't know — or care — which one ran.

## Layer 2 — Template engine

`lib/skill-template.ts` owns the artifact shape. Two entry points:

- `generateAnnotationSkillDraft(input)` — one annotation → one skill draft. The path the `/import` flow and per-annotation lesson exports use.
- `generateSkillDraft(lesson)` — whole lesson → one skill draft. The path the lesson-level "Collapse" button uses.

Both return a `SkillDraft = { name, description, body }`. `renderSkillFile(draft)` writes that to a valid YAML-frontmatter markdown string.

The engine handles:

- Slugifying `name` (kebab-case, ≤64 chars)
- Composing `description` with trigger phrases (so Claude picks the right skill when context matches)
- Composing `body` with `When to use this`, `Recipe`, `Why this works`, `Cross-language equivalents`, `What this skill does NOT do`

To add a new artifact format (MCP tool, agent definition, prompt template), you'd add a *new* engine that consumes the same `AnnotationSkillInput` and produces a different `*Draft`. The ingestor layer doesn't change.

## Layer 3 — Persistence

`app/api/skills/route.ts` is one POST endpoint. It validates a `SkillDraft` with Zod, refuses any name that escapes the skills root, atomically writes `{name}/SKILL.md` to `~/.claude/skills/`, and returns 409 on collision (no auto-suffix).

The persistence layer is deliberately small. It doesn't know what an ingestor or a template is. It writes a validated payload to a well-known location on the local filesystem so [Claude Code](https://claude.com/claude-code) can pick it up.

A second persistence target for MCP tools would be a sibling route writing to `~/.claude/mcp-servers/{name}/` (or wherever MCP server scaffolds end up living). Same shape, different destination.

## Why this layering matters

- **You can replace any single layer without touching the others.** Build your own ingestor; the engine still works. Swap the engine for an MCP-server generator; the ingestor still feeds it. Move persistence to a different location; everything upstream still functions.
- **Tests are tight.** The `lib/notebook/` parsers each have their own vitest file because parser correctness is independent of template correctness is independent of write correctness. 39 tests cover the slice.
- **Extension cost is bounded.** A new ingestor is ~3-4 files (`types.ts`, `parse-*.ts`, optional extractors, `to-annotation-input.ts`). See [build-your-own-ingestor.md](build-your-own-ingestor.md) for a worked example.

## What lives where

| Concern                  | Path                                |
| ------------------------ | ----------------------------------- |
| MDX ingestor             | `lib/lessons/`                      |
| Notebook ingestor        | `lib/notebook/`                     |
| Template engine          | `lib/skill-template.ts`             |
| Persistence              | `app/api/skills/route.ts`           |
| Skill quality linter     | `lib/skill-quality.ts`              |
| Example lessons          | `examples/concepts/*.mdx`           |
| Example notebooks        | `examples/notebooks/*.ipynb`        |
| Skills viewer            | `app/skills/`                       |
| Lesson viewer            | `app/concepts/[slug]/`              |
| Notebook import UI       | `app/import/`                       |
