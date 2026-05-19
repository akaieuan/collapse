# Collapse

> Annotated code lessons across Next.js · Vue · Nuxt · Qiskit — that *collapse* into Claude Code skills.

![Collapse — concepts index](public/screenshots/01-home.png)

## The idea

Reading a tutorial gets you to *"I understand this."*
Writing a Claude skill gets you to *"Claude understands this too."*

Collapse is the tool for the second step. Every lesson you author becomes a candidate `SKILL.md` in `~/.claude/skills/`. From that moment, Claude knows the pattern — with your annotations baked into its trigger phrases — and reaches for it the next time you ask *"how do I do X in [stack]"*.

## Why collapse skills across languages

Most of us live in one stack day-to-day. Mine is Next.js. Yours might be Vue, or Nuxt, or you're deep in Qiskit notebooks. The moment you switch — new job, side project, a teammate's codebase, a research direction — your default tool becomes a fresh learner. You're back to *"what's the Vue equivalent of `useState`?"* hand-waving, and Claude answers with generic syntax that doesn't match your existing instincts.

Cross-language skills fix that asymmetry. When you author one lesson for the same concept in multiple stacks, four things happen:

**1. You learn what's actually different.** Writing the Vue version after the Next version forces you to see *where* the languages diverge — not "`useState` ≈ `ref`" but: `ref` is pull-based, mutates `.value` in place, and the wrapper itself is the dependency edge. That's a distinction you only feel by writing both side-by-side. The lesson captures it. The skill carries it forward.

**2. Claude carries the translation.** The generated `SKILL.md` has a `Cross-language equivalents` section pulled from your other `<LangTab>`s. When you ask Claude *"how do I do reactive state in Nuxt"* in a Vue project, it loads the Vue skill, sees the Nuxt equivalent inline, and reaches into both at once. You skip the "Vue version, but Nuxt-flavored" round-trip and get the right answer first try.

**3. The library compounds.** Every new lesson can cite the ones beneath it. Once you have `vue-ref-computed`, authoring `vue-watch-effect` is faster because the trigger phrases inherit and the recipe builds on a primitive Claude already knows. Your `~/.claude/skills/` directory becomes a *vocabulary*, not a pile of disconnected files.

**4. Polyglot teams stop being islands.** A `SKILL.md` is just a plain markdown file with kebab-case frontmatter. Ship them via a shared dotfiles repo or a private gist; teammates drop them into their own `~/.claude/skills/`. A Next dev opening a Vue file in your codebase gets answers shaped like *their* mental model — with the translation key inline.

**5. Switching cost approaches zero.** You're not relearning Vue from scratch when you switch — you're learning where Vue and React *diverge*. Cross-stack lessons make that divergence the explicit unit of learning, instead of relearning the whole stack each time.

This is the actual leverage. The MDX authoring, the notebook import, the skill quality linter — all of that is plumbing in service of the same outcome: a personal library that closes the cost of moving between languages.

## The workflow

### 1 — Author the lesson

![Annotated lesson page with a pinned note](public/screenshots/03-lesson.png)

Lessons live in `content/concepts/*.mdx`. The authoring API is small:

```mdx
<LangTab lang="vue">

```vue {2-3#ref-state 5-7#computed-derive 11#v-bind} title="Counter.vue"
<script setup lang="ts">
import { ref, computed } from 'vue'

const count = ref(0)
const doubled = computed(() => count.value * 2)
</script>

<template>
  <button @click="count++">{{ doubled }}</button>
</template>
```

<Note id="ref-state" tip="ref() boxes a primitive so Vue can track reassignment" kind="core">
Unlike React's `useState`, Vue mutates `.value` in place — the wrapper *is* the dependency edge.
</Note>

<Note id="computed-derive" tip="computed() is a derived ref, recomputed only when its deps change" kind="core">
Pull-based reactivity: nothing runs until something reads the computed value.
</Note>

</LangTab>
```

Three pieces:
1. **Code fence with annotation metadata** — `{lines#id}` after the language tag.
2. **Sibling `<Note>` JSX blocks** — link an `id` to a tip + body + kind (`core`, `note`, `gotcha`, `mistake`, `mnemonic`, `cross`).
3. **`<LangTab lang="...">` wrapper** — scopes the code + notes to one stack so the same lesson can hold all four.

Hover or click any annotated token in the rendered page to reveal its note.

### 2 — Express it across stacks

![Reactivity model — Next.js and Vue side-by-side in the grid view](public/screenshots/06-lesson-grid-vue.png)

The grid view stacks all four stacks side-by-side. Above: *Reactivity model* in Next.js (`useState`) and Vue (`ref + computed`). The Nuxt version reuses Vue's primitives with SSR-safe defaults; Qiskit gets a `qiskitNote` explaining why the analog isn't direct.

This isn't decoration. The cross-stack discipline is the pedagogy: the moment you write the Vue version after the React one, you can *see* what changed — and so can the skill description, which carries cross-language equivalents into Claude's reasoning.

![Quantum audio encoding — Qiskit alongside Next.js](public/screenshots/02-lesson-grid.png)

Even when the analog isn't clean — Qiskit doesn't have JS-style reactivity, and quantum circuits don't model audio the way DSP libraries do — the comparison earns its place. Building a Qiskit skill next to its Next/Vue cousin clarifies what's *unique* about each stack, not just what's shared.

### 3 — Collapse it to a skill

One click on any lesson (or any single annotation within it) writes:

```
~/.claude/skills/{name}/SKILL.md
```

That file is what Claude Code reads. Here's a trimmed example of a real generated skill — note that the same shape holds whether the source lesson was Qiskit, Vue, Nuxt, or Next:

```markdown
---
name: vue-ref-computed
description: "Vue core concept: ref() boxes a primitive so Vue can
  track reassignment; computed() derives values that recompute only
  when their deps change. Use whenever the user is writing Vue
  code that touches local reactive state. Trigger phrases: 'ref()
  boxes a primitive…', 'pull-based reactivity', 'vue ref computed'.
  Collapse concept: reactivity."
---

# Vue: ref() boxes a primitive so Vue can track reassignment

**Kind:** Core concept. From the Collapse lesson `reactivity` (Reactivity model).

## When to use this
When writing or reviewing Vue code that touches the pattern below
— especially the core concept cases.

## Recipe
> ref() boxes a primitive so Vue can track reassignment
**Remember:** Pull-based reactivity — nothing runs until something reads.

```vue
<script setup lang="ts">
import { ref, computed } from 'vue'

const count = ref(0)
const doubled = computed(() => count.value * 2)
</script>
```

## Why this works
- **ref() boxes a primitive so Vue can track reassignment** — Unlike
  React's useState, Vue mutates .value in place — the wrapper *is*
  the dependency edge.
- **computed() is a derived ref** — recomputed only when its deps change.
  Pull-based reactivity: nothing runs until something reads.

## Cross-language equivalents
- **Next.js:** `useState` + manual derived values (or `useMemo`).
- **Nuxt:** same primitives as Vue, SSR-safe defaults via `useState` composable.
- **Qiskit:** no direct analog — quantum state evolves through gate
  application, observed only at measurement.

## What this skill does NOT do
- Does not pick a framework — only applies once the user has committed to Vue.
- Does not refactor unrelated code.
```

Two things to notice:
- The **description** carries trigger phrases pulled from your `tip` + `remember` + lesson title. Claude uses these to decide when to load this skill.
- The **Cross-language equivalents** block exists because the source lesson had `<LangTab>` blocks for the other stacks. If you only authored a Vue version, that section is omitted.

## Or — import someone else's notebook

![Import flow — parsed Qiskit notebook with admonition prefill](public/screenshots/04-import.png)

Not every skill starts as an MDX lesson you wrote. Some patterns live in Jupyter notebooks: the [Qiskit textbook](https://github.com/Qiskit/textbook), research notebooks, the [Executable Books](https://executablebooks.org) ecosystem.

Drop a `.ipynb` or MyST `.md` chapter into `/import`, pick the code cell that holds the pattern, annotate it, collapse it. MyST admonitions in nearby markdown cells (`:::{note}`, `:::{warning}`, `:::{important}`) **pre-fill the annotation form automatically** — `important` → core, `warning` → gotcha, `tip` → note.

The notebook stays ephemeral; only the skill persists.

## The skills directory

![Skills page showing ~/.claude/skills/](public/screenshots/05-skills.png)

`/skills` reads `~/.claude/skills/` directly. Quality verdicts come from a local linter — `clean`, `info`, `warn` — so you can see which skills carry their weight at a glance. Each row is a `SKILL.md` file; you can edit in any text editor, delete with `rm`, or copy somewhere to share.

## Run locally

```bash
git clone https://github.com/akaieuan/collapse.git
cd collapse
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000). Skills land in `~/.claude/skills/{name}/SKILL.md` and are picked up by [Claude Code](https://claude.com/claude-code) on the next session.

## Stack

Next.js 16 (App Router, RSC) · Tailwind v4 · shadcn/ui (Nova preset) · MDX · Shiki · Geist · TypeScript · Vitest · Playwright

---

Built by [Ieuan King](https://ubik.studio).
