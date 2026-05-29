# Roadmap

Collapse currently writes one artifact type: Claude Code skills (`SKILL.md`). The architecture is built for more.

## MCP tool generation — the next output target

[Model Context Protocol](https://modelcontextprotocol.io) servers are the natural second output type. They sit alongside skills in `~/.claude/`; many of the same patterns you'd capture as a skill could equally well be exposed as a tool Claude can invoke.

What this would look like:

- A new template engine (`lib/mcp-template.ts`) consuming the same `AnnotationSkillInput` Collapse already produces, but emitting a Node/TypeScript MCP server scaffold instead of `SKILL.md`.
- A new persistence target (`app/api/mcp-servers/route.ts`) writing to `~/.claude/mcp-servers/{name}/` with `package.json`, `tsconfig.json`, `index.ts`, and a `mcp.json` registration.
- A new toggle in the `Collapse` dialog: **collapse to skill** | **collapse to MCP tool**.

What's blocking: **nothing structural.** The ingestor layer doesn't change. The persistence layer is a duplicate of `/api/skills/route.ts` pointing at a different directory. The work is the template engine — designing the right MCP tool surface for what's currently a "code pattern + annotations" shape.

What's holding it back: **honest demand.** MCP tools are most valuable when they encapsulate *side effects* (call an API, hit a database, run a CLI). The patterns Collapse captures today are mostly pure code patterns. The first MCP target should be a category of skill where that distinction is real — e.g. "run this Qiskit circuit on AerSimulator", "fetch from this Vue composable", "scaffold a Next route".

Tentatively scheduled for v0.2.

## Other directions

### Multi-cell composition

Today: one cell → one skill. The notebook import flow can collapse exactly one code cell at a time. For patterns that genuinely span several cells (a multi-step pipeline, a class definition + its usage), composing them into a single skill would help.

The work is mostly UI: a "select multiple cells" mode in `/import` plus an aggregator in the adapter. The template engine already supports lesson-level multi-block output (`generateSkillDraft` consumes a whole `Lesson`).

### MyST chapter URL fetcher

Today: paste/upload only. Pointing the import flow at a public Jupyter Book chapter URL (Qiskit textbook, Executable Books, etc.) and parsing it inline would close one more click. A small fetch + sanitization layer.

### Skill sharing / sync

Today: skills are written to `~/.claude/skills/` on the local machine. Sharing is via dotfiles, gists, or a private repo. A `/skills/share` flow that builds a sharable archive of selected skills (with optional curated annotations) would help teams adopt them.

Possibly out of scope — `~/.claude/skills/` syncing belongs at the Claude Code or OS level, not in this app.

### Conversation-driven ingestor

Today: you start from a source (lesson, notebook, etc.). A conversation ingestor would invert the flow: chat with Claude about a pattern you're trying to articulate, and Collapse builds the skill from the transcript when it's good enough. Closer to "pair-program your skill into existence."

Speculative. Interesting. Not on the near roadmap.

## What we're explicitly NOT building

- **Kernel execution.** The 2026-05-02 pivot removed the Python sidecar. Notebook cells are read as static JSON, outputs ignored.
- **A hosted Collapse instance.** The product writes to your local `~/.claude/skills/`. A SaaS version would solve the wrong problem.
- **A skill marketplace.** Sharing is fine; ranking, monetizing, or curating skills at platform level is a different product.
- **A linter that auto-fixes skills.** The quality verdicts surface issues; the user decides what to do about them. Auto-fixing risks corrupting the trigger phrases that make a skill match correctly.

## Want to contribute?

The build-your-own-ingestor pattern documented in [docs/build-your-own-ingestor.md](build-your-own-ingestor.md) is the lowest-overhead way in. Add an ingestor for a source you actually work with, ship it, open a PR.
