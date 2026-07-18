"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  forgeStore,
  useForgeDrafts,
  type ForgeDraft,
} from "@/lib/forge/store";
import { lintDraft } from "@/lib/skill-quality";
import { SkillTestPanel } from "./skill-test-panel";
import { QualityBadges } from "./quality-badges";
import { DescriptionSharpener } from "./description-sharpener";
import { StructuredBodyEditor } from "./structured-body-editor";
import { DiffPreview } from "./diff-preview";

export function SkillForgeButton() {
  const drafts = useForgeDrafts();
  const [open, setOpen] = useState(false);
  const draftCount = drafts.filter((d) => d.status === "draft").length;
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group fixed bottom-6 right-6 z-40 inline-flex h-11 items-center gap-2.5 rounded-full border border-border/80 bg-background/95 px-4 text-sm font-medium text-foreground shadow-[0_8px_24px_-8px_oklch(0_0_0/0.18)] backdrop-blur transition-all hover:-translate-y-0.5 hover:border-foreground/30 hover:bg-background"
        aria-label="Open Skill Forge"
      >
        <span className="relative inline-flex h-6 w-6 items-center justify-center rounded-full bg-foreground text-background text-[11px]">
          <span className="absolute inset-0 rounded-full bg-[var(--brand)] opacity-0 transition-opacity group-hover:opacity-100" />
          <span className="relative">⚒</span>
        </span>
        <span className="font-mono text-[12px] uppercase tracking-[0.14em]">Forge</span>
        {draftCount > 0 && (
          <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--brand)] px-1.5 font-mono text-[10px] font-medium tabular-nums text-white">
            {draftCount}
          </span>
        )}
      </button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-full sm:max-w-lg p-0">
          <ForgePanel />
        </SheetContent>
      </Sheet>
    </>
  );
}

function ForgePanel() {
  const drafts = useForgeDrafts();
  const [activeId, setActiveId] = useState<string | null>(null);
  useEffect(() => {
    if (!activeId && drafts.length > 0) setActiveId(drafts[0].id);
  }, [activeId, drafts]);
  const active = drafts.find((d) => d.id === activeId) ?? null;

  return (
    <div className="flex h-full flex-col">
      <SheetHeader className="border-b border-border px-6 pb-4 pt-6 text-left">
        <div className="flex items-center justify-between">
          <SheetTitle className="text-base font-medium">Skill Forge</SheetTitle>
          <Badge variant="secondary" className="text-[10px]">
            {drafts.length} drafts
          </Badge>
        </div>
        <SheetDescription className="text-xs">
          Patterns captured from concept lessons. Refine, then collapse to{" "}
          <code className="font-mono">~/.claude/skills/</code>.
        </SheetDescription>
      </SheetHeader>

      <div className="grid flex-1 grid-rows-[auto,1fr] overflow-hidden">
        <div className="border-b border-border px-3 py-2">
          <DraftList drafts={drafts} activeId={activeId} onPick={setActiveId} />
        </div>
        <div className="overflow-y-auto px-6 py-5">
          {active ? (
            <DraftEditor key={active.id} draft={active} />
          ) : (
            <EmptyState />
          )}
        </div>
      </div>
    </div>
  );
}

function DraftList({
  drafts,
  activeId,
  onPick,
}: {
  drafts: ForgeDraft[];
  activeId: string | null;
  onPick: (id: string) => void;
}) {
  if (drafts.length === 0) return null;
  return (
    <ul className="flex max-h-32 flex-col gap-1 overflow-y-auto">
      {drafts.map((d) => (
        <li key={d.id}>
          <button
            type="button"
            onClick={() => onPick(d.id)}
            className={
              "flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors " +
              (activeId === d.id ? "bg-muted" : "hover:bg-muted/60")
            }
          >
            <span className="truncate">{d.title}</span>
            <span className="shrink-0">
              {d.status === "saved" ? (
                <Badge variant="outline" className="h-4 px-1 text-[9px]">collapsed</Badge>
              ) : (
                <Badge className="h-4 px-1 text-[9px]">draft</Badge>
              )}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

function EmptyState() {
  return (
    <div className="flex h-full flex-col items-center justify-center text-center text-sm text-muted-foreground">
      <div className="text-2xl">⚒</div>
      <p className="mt-2 max-w-sm leading-relaxed">
        No drafts yet. Open a concept lesson and capture a pattern — meaningful actions become draft skills here.
      </p>
    </div>
  );
}

function DraftEditor({ draft }: { draft: ForgeDraft }) {
  const [name, setName] = useState(draft.name);
  const [description, setDescription] = useState(draft.description);
  const [body, setBody] = useState(draft.body);
  const [busy, setBusy] = useState(false);
  const [collision, setCollision] = useState<{ existingDescription?: string } | null>(null);
  const [pendingEdit, setPendingEdit] = useState<{ prevBody: string; prevDescription: string } | null>(null);

  useEffect(() => {
    setName(draft.name);
    setDescription(draft.description);
    setBody(draft.body);
    setCollision(null);
    setPendingEdit(null);
  }, [draft.id, draft.name, draft.description, draft.body]);

  const issues = lintDraft({ name, description, body });
  const isEdit = draft.source.kind === "edit";

  function persist() {
    forgeStore.update(draft.id, { name, description, body });
  }

  async function save(overwrite: boolean) {
    setBusy(true);
    try {
      // For edit-mode, show a diff preview before committing the PUT.
      if (isEdit && draft.source.kind === "edit" && !pendingEdit) {
        const res = await fetch(
          `/api/skills/${encodeURIComponent(draft.source.existingName)}`,
        );
        const data = await res.json();
        if (!res.ok || !data.ok) {
          toast.error(`Couldn't load the on-disk version: ${data?.error ?? res.status}`);
          return;
        }
        setPendingEdit({ prevBody: data.body, prevDescription: data.description });
        return; // user reviews the diff and clicks Apply
      }

      const res = isEdit && draft.source.kind === "edit"
        ? await fetch(`/api/skills/${encodeURIComponent(draft.source.existingName)}`, {
            method: "PUT",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ description, body }),
          })
        : await fetch("/api/skills", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ name, description, body, overwrite }),
          });
      const data = await res.json();
      if (res.status === 409) {
        setCollision({ existingDescription: data?.existing?.description });
        return;
      }
      if (!res.ok) {
        toast.error(data?.error ?? "Failed to write skill");
        return;
      }
      forgeStore.markSaved(draft.id, { name: data.name ?? name, path: data.path, at: Date.now() });
      toast.success(`Collapsed → ${data.path}`);
      setCollision(null);
      setPendingEdit(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Badge variant="outline" className="text-[10px]">
          {draft.source.kind === "concept"
            ? `Concept · ${draft.source.conceptTitle}`
            : draft.source.kind === "edit"
              ? `Edit · ${draft.source.existingName}`
              : "Manual"}
        </Badge>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            if (confirm("Discard this draft?")) forgeStore.remove(draft.id);
          }}
          disabled={busy}
        >
          Discard
        </Button>
      </div>

      <div>
        <Label htmlFor="forge-name" className="mb-1 block text-[11px] uppercase tracking-wide text-muted-foreground">
          Name (kebab-case)
        </Label>
        <Input
          id="forge-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={persist}
          className="h-7 font-mono text-xs"
        />
        <p className="mt-1 font-mono text-[10px] text-muted-foreground">
          ~/.claude/skills/{name}/SKILL.md
        </p>
      </div>

      <div>
        <div className="mb-1 flex items-center justify-between gap-2">
          <Label htmlFor="forge-description" className="text-[11px] uppercase tracking-wide text-muted-foreground">
            Trigger description
          </Label>
          <DescriptionSharpener
            description={description}
            body={body}
            onApply={(next) => {
              setDescription(next);
              forgeStore.update(draft.id, { description: next });
            }}
          />
        </div>
        <Textarea
          id="forge-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          onBlur={persist}
          rows={5}
          className="text-[12px]"
        />
        <QualityBadges issues={issues} field="description" />
      </div>

      <div>
        <p className="mb-2 text-[11px] uppercase tracking-wide text-muted-foreground">
          Body (markdown — split into canonical sections)
        </p>
        <StructuredBodyEditor
          draftId={draft.id}
          body={body}
          onChange={(next) => {
            setBody(next);
            forgeStore.update(draft.id, { body: next });
          }}
        />
        <QualityBadges issues={issues} field="body" />
      </div>

      <SkillTestPanel
        draftId={draft.id}
        description={description}
        body={body}
        history={draft.testHistory ?? []}
      />

      {pendingEdit && (
        <div className="rounded-md border border-border bg-muted/40 p-3 space-y-3">
          <DiffPreview prev={pendingEdit.prevBody} next={body} />
          <div className="flex flex-wrap items-center gap-1.5">
            <Button size="sm" onClick={() => save(false)} disabled={busy}>
              {busy ? "Applying…" : "Apply changes"}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setPendingEdit(null)}
              disabled={busy}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {collision && (
        <div className="rounded-md border border-warning/40 bg-warning/10 p-3 text-xs">
          <p className="font-medium">A skill named &quot;{name}&quot; already exists.</p>
          {collision.existingDescription && (
            <p className="mt-1 line-clamp-2 text-muted-foreground">
              {collision.existingDescription}
            </p>
          )}
          <div className="mt-2 flex gap-2">
            <Button size="sm" onClick={() => save(true)} disabled={busy}>
              Overwrite
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setCollision(null)} disabled={busy}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      <Separator />

      <div className="flex items-center justify-between">
        <span className="text-[11px] text-muted-foreground">
          {draft.status === "saved" && draft.saved
            ? `Collapsed · ${new Date(draft.saved.at).toLocaleTimeString()}`
            : "Draft (uncollapsed)"}
        </span>
        <Button onClick={() => save(false)} disabled={busy} size="sm">
          {busy ? "Collapsing…" : draft.status === "saved" ? "Re-collapse" : "Collapse"}
        </Button>
      </div>
    </div>
  );
}
