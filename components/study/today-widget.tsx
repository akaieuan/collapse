"use client";

import Link from "next/link";
import { useDueCount } from "@/lib/study/store";

export function TodayWidget() {
  const due = useDueCount();
  if (due === 0) return null;
  return (
    <div className="mb-6 flex items-center gap-3 rounded-md border border-[var(--brand)]/30 bg-[var(--brand-soft)] px-3 py-2 font-mono text-[11px]">
      <span aria-hidden className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--brand)]" />
      <span className="uppercase tracking-[0.14em] text-[var(--brand)]">queue</span>
      <span className="tabular-nums text-foreground/80">
        <span className="text-foreground">{due}</span> due
      </span>
      <span className="text-muted-foreground/50">·</span>
      <span className="text-muted-foreground">five minutes a day</span>
      <Link
        href="/review"
        className="ml-auto inline-flex h-7 items-center rounded bg-foreground px-3 font-mono text-[10.5px] uppercase tracking-[0.08em] text-background transition-colors hover:bg-foreground/85"
      >
        Start review →
      </Link>
    </div>
  );
}
