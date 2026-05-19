"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type Draft = {
  name: string;
  description: string;
  body: string;
};

export function SkillExportDialog({
  slug,
  open,
  onOpenChange,
}: {
  slug: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [collision, setCollision] = useState<{ existingDescription?: string } | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setCollision(null);
    fetch(`/api/skills/draft?slug=${encodeURIComponent(slug)}`)
      .then((r) => r.json())
      .then((d: Draft) => {
        if (cancelled) return;
        setDraft(d);
      })
      .catch(() => {
        if (cancelled) return;
        toast.error("Failed to generate skill draft");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [slug, open]);

  const resolvedPath = useMemo(() => {
    if (!draft?.name) return "";
    return `~/.claude/skills/${draft.name}/SKILL.md`;
  }, [draft?.name]);

  const preview = useMemo(() => {
    if (!draft) return "";
    const desc = draft.description.replace(/\s+/g, " ").trim();
    return `---\nname: ${draft.name}\ndescription: ${desc}\n---\n\n${draft.body.trimEnd()}\n`;
  }, [draft]);

  async function submit(overwrite: boolean) {
    if (!draft) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/skills", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...draft, overwrite }),
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
      toast.success(`Collapsed → ${data.path}`);
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 p-0 sm:max-w-3xl">
        <DialogHeader className="space-y-2 border-b border-border/60 px-6 py-4">
          <div className="flex items-center justify-between gap-4">
            <DialogTitle className="font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
              Collapse skill
            </DialogTitle>
            {draft?.name ? (
              <span className="inline-flex items-center rounded-full border border-border/80 bg-muted/40 px-2.5 py-0.5 font-mono text-[11px] text-foreground">
                /{draft.name}
              </span>
            ) : null}
          </div>
          {resolvedPath ? (
            <p className="font-mono text-[11px] text-muted-foreground">{resolvedPath}</p>
          ) : null}
        </DialogHeader>

        {loading || !draft ? (
          <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
            Generating draft…
          </div>
        ) : (
          <div className="grid gap-5 px-6 py-5">
            <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
              <div className="flex min-w-0 flex-col gap-1.5">
                <Label
                  htmlFor="skill-name"
                  className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-muted-foreground"
                >
                  Name
                </Label>
                <Input
                  id="skill-name"
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  placeholder="kebab-case-name"
                  className="font-mono text-[13px]"
                />
              </div>
              <div className="flex min-w-0 flex-col gap-1.5">
                <Label
                  htmlFor="skill-description"
                  className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-muted-foreground"
                >
                  Trigger description
                </Label>
                <Textarea
                  id="skill-description"
                  value={draft.description}
                  onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                  rows={3}
                  className="field-sizing-fixed resize-none text-[13px] leading-relaxed"
                />
              </div>
            </div>

            <div className="flex min-w-0 flex-col gap-1.5">
              <Label className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-muted-foreground">
                Body
              </Label>
              <Tabs defaultValue="edit" className="w-full min-w-0">
                <TabsList className="h-8 bg-muted/40">
                  <TabsTrigger value="edit" className="text-[12px]">
                    Edit
                  </TabsTrigger>
                  <TabsTrigger value="preview" className="text-[12px]">
                    Preview
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="edit" className="mt-2">
                  <Textarea
                    value={draft.body}
                    onChange={(e) => setDraft({ ...draft, body: e.target.value })}
                    className="field-sizing-fixed h-[300px] resize-none rounded-md border font-mono text-[12px] leading-relaxed"
                    aria-label="Skill body"
                  />
                </TabsContent>
                <TabsContent value="preview" className="mt-2">
                  <pre className="h-[300px] overflow-auto rounded-md border bg-muted/30 p-4 font-mono text-[12px] leading-relaxed whitespace-pre-wrap break-words text-foreground/90">
                    {preview}
                  </pre>
                </TabsContent>
              </Tabs>
            </div>

            {collision ? (
              <div className="rounded-md border border-border bg-muted/40 p-3 text-sm">
                <p className="font-medium">
                  A skill named &quot;{draft.name}&quot; already exists.
                </p>
                {collision.existingDescription ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Current description: {collision.existingDescription.slice(0, 140)}…
                  </p>
                ) : null}
                <div className="mt-3 flex gap-2">
                  <Button
                    size="sm"
                    variant="default"
                    onClick={() => submit(true)}
                    disabled={submitting}
                  >
                    Overwrite
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setCollision(null);
                      document.getElementById("skill-name")?.focus();
                    }}
                  >
                    Rename
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
        )}

        <DialogFooter className="gap-2 border-t border-border/60 px-6 py-3">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={() => submit(false)} disabled={!draft || submitting || loading}>
            {submitting ? "Collapsing…" : "Collapse"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
