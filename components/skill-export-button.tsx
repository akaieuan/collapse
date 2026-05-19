"use client";

import { useState } from "react";
import { SkillExportDialog } from "./skill-export-dialog";

export function SkillExportButton({ slug }: { slug: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-8 items-center rounded-md bg-foreground px-3 font-mono text-[11px] uppercase tracking-[0.08em] text-background transition-colors hover:bg-foreground/85"
      >
        Collapse skill
        <span aria-hidden className="ml-1.5 text-background/70">↓</span>
      </button>
      {open && <SkillExportDialog slug={slug} open={open} onOpenChange={setOpen} />}
    </>
  );
}
