"use client";

import { useMemo } from "react";
import { lineDiff, diffStats } from "@/lib/line-diff";

export function DiffPreview({
  prev,
  next,
  maxLines = 80,
}: {
  prev: string;
  next: string;
  maxLines?: number;
}) {
  const segments = useMemo(() => lineDiff(prev, next), [prev, next]);
  const stats = useMemo(() => diffStats(segments), [segments]);

  // Trim long unchanged stretches so the eye lands on the changed parts.
  const visible = useMemo(() => {
    if (segments.length <= maxLines) return segments;
    const truncated: typeof segments = [];
    const sameIndices = new Set<number>();
    segments.forEach((s, i) => {
      if (s.type === "same") sameIndices.add(i);
    });
    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      if (seg.type !== "same") {
        truncated.push(seg);
        continue;
      }
      const prevChanged =
        truncated[truncated.length - 1] &&
        truncated[truncated.length - 1].type !== "same" &&
        truncated[truncated.length - 1].text !== "…";
      const nextChanged = segments[i + 1]?.type && segments[i + 1].type !== "same";
      if (prevChanged || nextChanged) {
        truncated.push(seg);
      } else if (
        truncated.length === 0 ||
        truncated[truncated.length - 1].text !== "…"
      ) {
        truncated.push({ type: "same", text: "…" });
      }
    }
    return truncated;
  }, [segments, maxLines]);

  if (stats.added === 0 && stats.removed === 0) {
    return (
      <p className="font-mono text-[11px] text-muted-foreground">
        No changes — body and description match what's on disk.
      </p>
    );
  }

  return (
    <div>
      <p className="mb-2 font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground">
        Diff preview ·{" "}
        <span className="text-emerald-600 dark:text-emerald-400">+{stats.added}</span>{" "}
        <span className="text-destructive">−{stats.removed}</span>
      </p>
      <pre className="max-h-72 overflow-auto rounded border border-border bg-muted/30 p-2 font-mono text-[11px] leading-relaxed">
        {visible.map((seg, i) => (
          <DiffLine key={i} seg={seg} />
        ))}
      </pre>
    </div>
  );
}

function DiffLine({ seg }: { seg: { type: "same" | "add" | "del"; text: string } }) {
  if (seg.type === "add") {
    return (
      <div className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
        <span aria-hidden className="mr-2 select-none">+</span>
        {seg.text || " "}
      </div>
    );
  }
  if (seg.type === "del") {
    return (
      <div className="bg-destructive/10 text-destructive">
        <span aria-hidden className="mr-2 select-none">-</span>
        {seg.text || " "}
      </div>
    );
  }
  return (
    <div className="text-muted-foreground/80">
      <span aria-hidden className="mr-2 select-none">·</span>
      {seg.text || " "}
    </div>
  );
}
