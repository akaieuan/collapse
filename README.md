# Collapse

> Annotated code lessons across Next.js · Vue · Nuxt · Qiskit — that *collapse* into Claude Code skills.

![Collapse — concepts index](public/screenshots/01-home.png)

## The idea

Reading a tutorial gets you to *"I understand this."*
Writing a Claude skill gets you to *"Claude understands this too."*

Collapse is the tool in between. Author a short lesson with annotated code in MDX. Press one button. A `SKILL.md` lands in `~/.claude/skills/`. From that moment Claude knows the pattern — with your annotations baked into its trigger phrases.

## Cross-stack lessons

![Lesson grid view](public/screenshots/02-lesson-grid.png)

Each concept can express the same pattern in four stacks: Next.js, Vue, Nuxt, Qiskit. Hover any annotated token to see the note inline. The grid view stacks all four for side-by-side comparison — which is where the cross-language *vocabulary* gets built.

## Collapse → skill

![Annotated lesson page with pinned note](public/screenshots/03-lesson.png)

Every annotation is a candidate skill on its own. One click writes `~/.claude/skills/{name}/SKILL.md` with a recipe section, a "why this works" derived from your notes, and trigger phrases pulled from the tip + remember fields.

## Notebook import

![Import flow — parsed Qiskit notebook with admonition prefill](public/screenshots/04-import.png)

Reading a Qiskit textbook chapter or any other [Jupyter Book](https://jupyterbook.org)? Drop a `.ipynb` or MyST `.md` into `/import`, pick the code cell that holds the pattern, annotate it, collapse it. MyST admonitions (`:::{note}`, `:::{warning}`, `:::{important}`) in nearby markdown cells **pre-fill the annotation form automatically** — `important` → core, `warning` → gotcha, `tip` → note. The notebook itself stays ephemeral; only the skill persists.

## The skills directory

![Skills page showing ~/.claude/skills/](public/screenshots/05-skills.png)

The `/skills` page reads `~/.claude/skills/` directly. Quality verdicts come from a local linter — `clean`, `info`, `warn` — so you can see at a glance which skills carry their weight. Every skill is just a `SKILL.md` file with kebab-case frontmatter; you can edit it in any text editor or delete it with `rm`.

## Run locally

```bash
git clone https://github.com/akaieuan/collapse.git
cd collapse
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000). Skills are written to `~/.claude/skills/{name}/SKILL.md` so they're picked up by [Claude Code](https://claude.com/claude-code) immediately on the next session.

### Scripts

| Command            | What it does                                                        |
| ------------------ | ------------------------------------------------------------------- |
| `pnpm dev`         | Start the Next.js dev server                                        |
| `pnpm test`        | Run the Vitest suite (notebook parsers, annotation extraction, etc.) |
| `pnpm typecheck`   | `tsc --noEmit`                                                      |
| `pnpm screenshots` | Capture the README screenshots from the running dev server          |

## Stack

Next.js 16 (App Router, RSC) · Tailwind v4 · shadcn/ui (Nova preset) · MDX · Shiki · Geist · TypeScript · Vitest · Playwright

---

Built by [Ieuan King](https://ubik.studio).
