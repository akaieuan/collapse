"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { forgeStore } from "@/lib/forge/store";

type LoadResponse =
  | { ok: true; name: string; description: string; body: string; path: string }
  | { ok: false; error: string; message?: string };

type DeleteResponse = { ok: boolean; error?: string; message?: string };

export function SkillRowActions({
  dirName,
  displayName,
}: {
  dirName: string;
  displayName: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<"edit" | "delete" | null>(null);
  const [pending, startTransition] = useTransition();

  async function handleEdit() {
    setBusy("edit");
    try {
      const res = await fetch(`/api/skills/${encodeURIComponent(dirName)}`);
      const data = (await res.json()) as LoadResponse;
      if (!data.ok) {
        toast.error(`Couldn't load: ${data.error}`);
        return;
      }
      forgeStore.capture({
        source: { kind: "edit", existingName: data.name, path: data.path },
        title: `${data.name} (edit)`,
        name: data.name,
        description: data.description,
        body: data.body,
      });
      toast.success(`${data.name} opened in the Forge — click the Forge button (bottom right) to refine.`);
    } finally {
      setBusy(null);
    }
  }

  async function handleDelete() {
    if (!confirm(`Delete ${displayName}? This removes ~/.claude/skills/${dirName}/ from disk. Cannot be undone.`)) {
      return;
    }
    setBusy("delete");
    try {
      const res = await fetch(`/api/skills/${encodeURIComponent(dirName)}`, {
        method: "DELETE",
      });
      const data = (await res.json()) as DeleteResponse;
      if (!data.ok) {
        toast.error(`Couldn't delete: ${data.error ?? "unknown"}`);
        return;
      }
      toast.success(`Deleted ${displayName}.`);
      startTransition(() => router.refresh());
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="ml-2 flex items-center gap-1">
      <button
        type="button"
        onClick={handleEdit}
        disabled={busy !== null || pending}
        className="inline-flex h-6 items-center rounded border border-border bg-background px-2 font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground transition-colors enabled:hover:border-foreground/30 enabled:hover:bg-muted enabled:hover:text-foreground disabled:opacity-40"
      >
        {busy === "edit" ? "…" : "Edit"}
      </button>
      <button
        type="button"
        onClick={handleDelete}
        disabled={busy !== null || pending}
        className="inline-flex h-6 items-center rounded border border-destructive/40 bg-background px-2 font-mono text-[10px] uppercase tracking-[0.08em] text-destructive/85 transition-colors enabled:hover:border-destructive enabled:hover:bg-destructive/10 disabled:opacity-40"
      >
        {busy === "delete" ? "…" : "Delete"}
      </button>
    </div>
  );
}
