"use client";

import { useEffect } from "react";
import { useRecallMode } from "@/lib/study/store";

export function RecallToggle({ slug }: { slug: string }) {
  const [on, setOn] = useRecallMode(slug);

  useEffect(() => {
    if (on) {
      document.documentElement.classList.add("recall-mode");
    } else {
      document.documentElement.classList.remove("recall-mode");
    }
    return () => {
      document.documentElement.classList.remove("recall-mode");
    };
  }, [on]);

  return (
    <label
      className={
        "inline-flex h-8 cursor-pointer select-none items-center gap-1.5 rounded-md border px-2.5 font-mono text-[11px] uppercase tracking-[0.08em] transition-colors " +
        (on
          ? "border-[var(--brand)]/40 bg-[var(--brand-soft)] text-[var(--brand)]"
          : "border-border bg-background text-muted-foreground hover:border-foreground/30 hover:text-foreground")
      }
    >
      <input
        type="checkbox"
        checked={on}
        onChange={(e) => setOn(e.target.checked)}
        className="sr-only"
      />
      <span aria-hidden className="text-[12px]">{on ? "■" : "□"}</span>
      <span>Recall</span>
    </label>
  );
}
