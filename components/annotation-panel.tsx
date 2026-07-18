"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { XIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useLesson } from "./lesson-provider";
import { ANNOTATION_KIND_LABEL, LANG_LABELS, type AnnotationKind, type LangKey } from "@/lib/lessons/types";
import { snippetForAnnotation } from "@/lib/lessons/snippet";
import { generateAnnotationSkillDraft } from "@/lib/skill-template";
import { forgeStore } from "@/lib/forge/store";

export function AnnotationPanel() {
  const { activeAnnotationId, clearAnnotation, findAnnotation, lesson, setActiveLang, pinAnnotation } = useLesson();
  const found = activeAnnotationId ? findAnnotation(activeAnnotationId) : null;

  const skillDraft = found
    ? generateAnnotationSkillDraft({
        lessonSlug: lesson.frontmatter.slug,
        lessonTitle: lesson.frontmatter.title,
        lang: found.lang,
        shikiLang: found.shikiLang,
        annotationId: found.annotation.id,
        kind: found.annotation.kind,
        tip: found.annotation.tip,
        remember: found.annotation.remember,
        body: found.annotation.body,
        detail: found.annotation.detail,
        codeSnippet: snippetForAnnotation(found.code, found.meta, found.annotation.id, 3),
      })
    : null;

  const codeSnippet = useMemo(
    () =>
      found
        ? snippetForAnnotation(found.code, found.meta, found.annotation.id, 2)
        : "",
    [found],
  );

  // Sibling navigation within the same language code
  const { siblings, position, prev, next } = useMemo(() => {
    if (!found) return { siblings: [], position: -1, prev: null, next: null };
    const langCode = lesson.codes.find((c) => c.lang === found.lang);
    const list = langCode?.annotations ?? [];
    const idx = list.findIndex((a) => a.id === found.annotation.id);
    return {
      siblings: list,
      position: idx,
      prev: idx > 0 ? list[idx - 1] : null,
      next: idx >= 0 && idx < list.length - 1 ? list[idx + 1] : null,
    };
  }, [found, lesson.codes]);

  // Cross-stack peers — same id in other languages
  const crossStack = useMemo(() => {
    if (!found) return [] as { lang: LangKey; tip: string; remember: string }[];
    return lesson.codes
      .filter((c) => c.lang !== found.lang)
      .map((c) => {
        const peer = c.annotations.find((a) => a.id === found.annotation.id);
        return peer ? { lang: c.lang, tip: peer.tip, remember: peer.remember } : null;
      })
      .filter((x): x is { lang: LangKey; tip: string; remember: string } => Boolean(x));
  }, [found, lesson.codes]);

  const [skillOpen, setSkillOpen] = useState(false);
  useEffect(() => { setSkillOpen(false); }, [activeAnnotationId]);

  useEffect(() => {
    const root = document.querySelector("[data-annotated-root]");
    if (!root) return;
    root.querySelectorAll("[data-annot-id]").forEach((el) => {
      if (activeAnnotationId && el.getAttribute("data-annot-id") === activeAnnotationId) {
        el.setAttribute("data-pinned", "true");
      } else {
        el.removeAttribute("data-pinned");
      }
    });
  }, [activeAnnotationId]);

  if (!found) return null;

  return (
    <section
      aria-labelledby="annotation-panel-title"
      className="relative mt-4 overflow-hidden rounded-2xl border border-border/40 bg-card/40"
    >
      <span
        aria-hidden
        className="absolute inset-x-0 top-0 h-[2px]"
        style={{ backgroundColor: kindToVar(found.annotation.kind) }}
      />

      {/* Status bar — single dense line */}
      <div className="flex items-center gap-2.5 border-b border-border/70 bg-muted/40 px-4 py-2 font-mono text-[10.5px]">
        <KindChip kind={found.annotation.kind} />
        <span className="text-muted-foreground/60">·</span>
        <span className="uppercase tracking-[0.12em] text-muted-foreground">
          {LANG_LABELS[found.lang]}
        </span>
        <span className="text-muted-foreground/60">·</span>
        <code className="rounded bg-background px-1.5 py-0.5 text-[10px] text-foreground/80">
          #{found.annotation.id}
        </code>
        {position >= 0 && siblings.length > 1 && (
          <>
            <span className="text-muted-foreground/60">·</span>
            <span className="tabular-nums text-muted-foreground">
              {String(position + 1).padStart(2, "0")} / {String(siblings.length).padStart(2, "0")}
            </span>
          </>
        )}
        <button
          type="button"
          onClick={clearAnnotation}
          aria-label="Close note"
          className="ml-auto -mr-1 shrink-0 rounded p-1 text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
        >
          <XIcon className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="px-4 py-4">
        <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_240px]">
            {/* Main content column */}
            <div className="min-w-0 space-y-4">
              {/* Title block */}
              <div className="space-y-1">
                {found.annotation.remember ? (
                  <h2
                    id="annotation-panel-title"
                    className="text-[17px] font-medium leading-snug tracking-tight"
                    style={{
                      color: "var(--annot-c)",
                      ["--annot-c" as never]: kindToVar(found.annotation.kind),
                    }}
                  >
                    {found.annotation.remember}
                  </h2>
                ) : (
                  <h2 id="annotation-panel-title" className="text-[17px] font-medium leading-snug tracking-tight">
                    {found.annotation.tip || found.annotation.id}
                  </h2>
                )}
                {found.annotation.remember && found.annotation.tip && (
                  <p className="text-[12.5px] leading-relaxed text-muted-foreground">
                    {found.annotation.tip}
                  </p>
                )}
              </div>

              {codeSnippet && <CodeSnippet code={codeSnippet} lang={found.lang} />}

              <NoteBody body={found.annotation.body} />

              {found.annotation.detail && <AuthoredDetail text={found.annotation.detail} />}

              {skillOpen && skillDraft && (
                <>
                  <Separator />
                  <SkillPreview
                    draft={skillDraft}
                    lessonTitle={lesson.frontmatter.title}
                    annotationTip={found.annotation.tip || found.annotation.id}
                  />
                </>
              )}
            </div>

            {/* Sidebar column — siblings + cross-stack + actions */}
            <aside className="space-y-5 md:border-l md:border-border/60 md:pl-5">
              <NotesIndex
                siblings={siblings}
                activeId={found.annotation.id}
                onPick={(id) => pinAnnotation(id)}
              />

              {crossStack.length > 0 && (
                <CrossStackPeers
                  peers={crossStack}
                  onJump={(lang) => {
                    setActiveLang(lang);
                    pinAnnotation(found.annotation.id);
                  }}
                />
              )}

              <PanelActions
                skillOpen={skillOpen}
                prev={prev}
                next={next}
                onPrev={() => prev && pinAnnotation(prev.id)}
                onNext={() => next && pinAnnotation(next.id)}
                onCreateSkill={() => setSkillOpen(true)}
              />
            </aside>
        </div>
      </div>
    </section>
  );
}

function NotesIndex({
  siblings,
  activeId,
  onPick,
}: {
  siblings: { id: string; kind: AnnotationKind; tip: string; remember: string }[];
  activeId: string;
  onPick: (id: string) => void;
}) {
  if (siblings.length <= 1) return null;
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between">
        <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
          Notes in this stack
        </p>
        <span className="font-mono text-[10px] tabular-nums text-muted-foreground/70">
          {String(siblings.length).padStart(2, "0")}
        </span>
      </div>
      <ul className="space-y-0.5">
        {siblings.map((s, i) => {
          const isActive = s.id === activeId;
          const color = kindToVar(s.kind);
          return (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => onPick(s.id)}
                aria-current={isActive ? "true" : undefined}
                className={
                  "group flex w-full items-start gap-2 rounded px-2 py-1.5 text-left transition-colors " +
                  (isActive
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:bg-muted/60 hover:text-foreground")
                }
              >
                <span className="mt-0.5 font-mono text-[9.5px] tabular-nums text-muted-foreground/60">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span
                  aria-hidden
                  className="mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{ backgroundColor: color }}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12px] leading-snug">
                    {s.remember || s.tip || s.id}
                  </span>
                  <span className="block truncate font-mono text-[10px] text-muted-foreground/70">
                    #{s.id}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function CodeSnippet({ code, lang }: { code: string; lang: LangKey }) {
  return (
    <div className="mb-5 overflow-hidden rounded-md border border-border/70 bg-muted/40">
      <div className="flex items-center justify-between border-b border-border/60 bg-background/40 px-3 py-1.5">
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
          Code in context
        </span>
        <span className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground/70">
          {LANG_LABELS[lang]}
        </span>
      </div>
      <pre className="overflow-x-auto px-3 py-2.5 font-mono text-[12px] leading-relaxed text-foreground/85">
        {code}
      </pre>
    </div>
  );
}

function CrossStackPeers({
  peers,
  onJump,
}: {
  peers: { lang: LangKey; tip: string; remember: string }[];
  onJump: (lang: LangKey) => void;
}) {
  return (
    <div>
      <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
        Same idea in
      </p>
      <ul className="space-y-1">
        {peers.map((p) => (
          <li key={p.lang}>
            <button
              type="button"
              onClick={() => onJump(p.lang)}
              className="group flex w-full items-start gap-2 rounded px-2 py-1.5 text-left text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
            >
              <span className="mt-0.5 inline-flex h-4 shrink-0 items-center rounded-full border border-border/70 bg-background px-1.5 font-mono text-[9.5px] uppercase tracking-wide">
                {LANG_LABELS[p.lang]}
              </span>
              <span className="min-w-0 flex-1 truncate text-[12px] leading-snug">
                {p.remember || p.tip || "Open"}
              </span>
              <span aria-hidden className="text-muted-foreground/70 group-hover:text-foreground">↗</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function KindChip({ kind }: { kind: AnnotationKind }) {
  const color = kindToVar(kind);
  return (
    <span
      className="inline-flex h-5 items-center rounded-full border px-2 font-mono text-[10px] font-medium uppercase tracking-wide"
      style={{
        color,
        backgroundColor: `color-mix(in oklab, ${color} 10%, transparent)`,
        borderColor: `color-mix(in oklab, ${color} 28%, transparent)`,
      }}
    >
      {ANNOTATION_KIND_LABEL[kind]}
    </span>
  );
}

function kindToVar(kind: AnnotationKind): string {
  switch (kind) {
    case "core": return "var(--annot-core)";
    case "gotcha": return "var(--annot-gotcha)";
    case "mistake": return "var(--annot-mistake)";
    case "mnemonic": return "var(--annot-mnemonic)";
    case "cross": return "var(--annot-cross)";
    default: return "var(--annot-note)";
  }
}

function NoteBody({ body }: { body: string }) {
  const paragraphs = body.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  return (
    <div className="prose-sm space-y-3 text-sm leading-relaxed text-foreground/90">
      {paragraphs.length > 0 ? (
        paragraphs.map((p, i) => <p key={i}>{p}</p>)
      ) : (
        <p className="text-muted-foreground">No detail provided.</p>
      )}
    </div>
  );
}

function AuthoredDetail({ text }: { text: string }) {
  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          Deeper explanation
        </span>
        <Badge variant="outline" className="text-[9px]">authored</Badge>
      </div>
      <DetailBody text={text} />
    </div>
  );
}

function SkillPreview({
  draft,
  lessonTitle,
  annotationTip,
}: {
  draft: { name: string; description: string; body: string };
  lessonTitle: string;
  annotationTip: string;
}) {
  const [name, setName] = useState(draft.name);
  const [description, setDescription] = useState(draft.description);
  const [body, setBody] = useState(draft.body);
  const [busy, setBusy] = useState(false);
  const [collision, setCollision] = useState(false);
  const [savedPath, setSavedPath] = useState<string | null>(null);

  async function copy() {
    try {
      const yaml = `---\nname: ${name}\ndescription: ${JSON.stringify(description)}\n---\n\n${body}\n`;
      await navigator.clipboard.writeText(yaml);
      toast.success("SKILL.md copied to clipboard.");
    } catch {
      toast.error("Couldn't copy. Select and copy from the preview.");
    }
  }

  async function save(overwrite: boolean) {
    setBusy(true);
    try {
      const res = await fetch("/api/skills", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, description, body, overwrite }),
      });
      const data = await res.json();
      if (res.status === 409) {
        setCollision(true);
        return;
      }
      if (!res.ok) {
        toast.error(data?.error ?? "Failed to write skill");
        return;
      }
      setSavedPath(data.path);
      setCollision(false);
      toast.success(`Collapsed → ${data.path}`);
    } finally {
      setBusy(false);
    }
  }

  function addToForge() {
    forgeStore.capture({
      source: { kind: "concept", slug: draft.name, conceptTitle: `${lessonTitle} — ${annotationTip}` },
      title: `${lessonTitle}: ${annotationTip}`,
      name,
      description,
      body,
    });
    toast.success("Added to the Forge — click the Forge button (bottom right) to refine.");
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Collapse draft
          </span>
          <Badge variant="outline" className="text-[9px]">SKILL.md</Badge>
        </div>
      </div>
      <p className="mb-3 text-[11px] text-muted-foreground">
        A focused skill scoped to this single annotation. Collapse it and Claude will know this pattern in any future session — no copy-paste needed.
      </p>

      <div className="space-y-3">
        <div>
          <label className="mb-1 block text-[10px] uppercase tracking-wide text-muted-foreground" htmlFor="annot-skill-name">
            Name
          </label>
          <input
            id="annot-skill-name"
            value={name}
            onChange={(e) => { setName(e.target.value); setCollision(false); setSavedPath(null); }}
            className="w-full rounded-md border border-border bg-background px-2 py-1 font-mono text-xs"
          />
          <p className="mt-1 font-mono text-[10px] text-muted-foreground">~/.claude/skills/{name}/SKILL.md</p>
        </div>

        <div>
          <label className="mb-1 block text-[10px] uppercase tracking-wide text-muted-foreground" htmlFor="annot-skill-desc">
            Trigger description
          </label>
          <textarea
            id="annot-skill-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-[11.5px] leading-snug"
          />
        </div>

        <details className="rounded-md border border-border bg-muted/30">
          <summary className="cursor-pointer select-none px-3 py-2 text-[11px] font-medium">
            Preview body ({body.split("\n").length} lines)
          </summary>
          <pre className="max-h-64 overflow-y-auto px-3 pb-3 font-mono text-[11px] leading-snug whitespace-pre-wrap">
            {body}
          </pre>
        </details>

        {collision && (
          <div className="rounded-md border border-warning/40 bg-warning/10 p-2.5 text-xs">
            <p className="font-medium">A skill named &quot;{name}&quot; already exists.</p>
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={() => save(true)}
                disabled={busy}
                className="rounded-md bg-foreground px-2.5 py-1 text-xs text-background transition-colors hover:bg-foreground/90"
              >
                Overwrite
              </button>
              <button
                type="button"
                onClick={() => setCollision(false)}
                className="rounded-md border border-border px-2.5 py-1 text-xs transition-colors hover:bg-muted"
              >
                Rename
              </button>
            </div>
          </div>
        )}

        {savedPath && (
          <p className="text-[11px] text-foreground/70">
            Saved to <code className="rounded bg-muted px-1 font-mono">{savedPath}</code>. Claude will pick it up on the next session.
          </p>
        )}

        <div className="flex flex-wrap items-center gap-2 pt-1">
          <button
            type="button"
            onClick={() => save(false)}
            disabled={busy}
            className="rounded-md bg-foreground px-2.5 py-1 text-xs text-background transition-colors hover:bg-foreground/90 disabled:opacity-50"
          >
            {busy ? "Collapsing…" : "Collapse"}
          </button>
          <button
            type="button"
            onClick={addToForge}
            className="rounded-md border border-border bg-background px-2.5 py-1 text-xs transition-colors hover:bg-muted"
          >
            Add to Forge
          </button>
          <button
            type="button"
            onClick={copy}
            className="rounded-md border border-border bg-background px-2.5 py-1 text-xs transition-colors hover:bg-muted"
          >
            Copy SKILL.md
          </button>
        </div>
      </div>
    </div>
  );
}

function DetailBody({ text }: { text: string }) {
  // Split on blank lines, then render fenced code blocks vs prose blocks.
  const blocks = text.split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean);
  return (
    <div className="space-y-3 text-sm leading-relaxed">
      {blocks.map((block, i) => {
        if (block.startsWith("```")) {
          const stripped = block.replace(/^```\w*\n?/, "").replace(/\n?```$/, "");
          return (
            <pre
              key={i}
              className="overflow-x-auto rounded-md border border-border bg-muted px-3 py-2 font-mono text-[12px] leading-snug"
            >
              {stripped}
            </pre>
          );
        }
        if (block.startsWith("- ")) {
          const items = block.split(/\n/).map((l) => l.replace(/^-\s+/, ""));
          return (
            <ul key={i} className="ml-4 list-disc space-y-1.5 text-foreground/90">
              {items.map((it, j) => <li key={j}>{renderInline(it)}</li>)}
            </ul>
          );
        }
        return <p key={i} className="text-foreground/90">{renderInline(block)}</p>;
      })}
    </div>
  );
}

function renderInline(s: string): React.ReactNode {
  // Render `code` and **bold** spans
  const parts: React.ReactNode[] = [];
  const re = /(`[^`]+`|\*\*[^*]+\*\*)/g;
  let lastIdx = 0;
  let key = 0;
  for (const m of s.matchAll(re)) {
    if (m.index! > lastIdx) parts.push(s.slice(lastIdx, m.index));
    const tok = m[0];
    if (tok.startsWith("`")) {
      parts.push(<code key={key++} className="rounded bg-muted px-1 py-0.5 font-mono text-[12px]">{tok.slice(1, -1)}</code>);
    } else {
      parts.push(<strong key={key++}>{tok.slice(2, -2)}</strong>);
    }
    lastIdx = m.index! + tok.length;
  }
  if (lastIdx < s.length) parts.push(s.slice(lastIdx));
  return parts;
}

function PanelActions({
  skillOpen,
  prev,
  next,
  onPrev,
  onNext,
  onCreateSkill,
}: {
  skillOpen: boolean;
  prev: { id: string; tip: string; remember: string } | null;
  next: { id: string; tip: string; remember: string } | null;
  onPrev: () => void;
  onNext: () => void;
  onCreateSkill: () => void;
}) {
  return (
    <div>
      <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
        Actions
      </p>
      <div className="flex flex-wrap items-center gap-1">
        {!skillOpen && (
          <button
            type="button"
            onClick={onCreateSkill}
            className="inline-flex h-7 items-center rounded bg-foreground px-2.5 font-mono text-[10.5px] uppercase tracking-[0.08em] text-background transition-colors hover:bg-foreground/85"
          >
            Collapse skill
            <span aria-hidden className="ml-1 text-background/70">↓</span>
          </button>
        )}
        <div className="ml-auto flex items-center">
          <button
            type="button"
            onClick={onPrev}
            disabled={!prev}
            aria-label={prev ? `Previous note: ${prev.tip || prev.id}` : "No previous note"}
            title={prev ? prev.remember || prev.tip || prev.id : undefined}
            className="inline-flex h-7 w-7 items-center justify-center rounded-l border border-r-0 border-border bg-background font-mono text-[12px] text-foreground transition-colors enabled:hover:border-foreground/30 enabled:hover:bg-muted disabled:opacity-40"
          >
            ←
          </button>
          <button
            type="button"
            onClick={onNext}
            disabled={!next}
            aria-label={next ? `Next note: ${next.tip || next.id}` : "No next note"}
            title={next ? next.remember || next.tip || next.id : undefined}
            className="inline-flex h-7 w-7 items-center justify-center rounded-r border border-border bg-background font-mono text-[12px] text-foreground transition-colors enabled:hover:border-foreground/30 enabled:hover:bg-muted disabled:opacity-40"
          >
            →
          </button>
        </div>
      </div>
    </div>
  );
}
