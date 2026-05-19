"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  studyStore,
  useStudyEntries,
  formatRelativeDue,
} from "@/lib/study/store";
import { ANNOTATION_KIND_LABEL, type AnnotationKind } from "@/lib/lessons/types";

type FlatAnnot = {
  key: string;
  slug: string;
  annotId: string;
  title: string;
  kind: AnnotationKind;
  tip: string;
  remember: string;
  body: string;
  codeSnippet: string;
  codeLang: string;
};

export function ReviewSession({ allAnnotations }: { allAnnotations: FlatAnnot[] }) {
  const entries = useStudyEntries();
  const now = Date.now();
  const dueQueue = useMemo(() => {
    const dueKeys = new Set(entries.filter((e) => e.dueAt <= now).map((e) => e.key));
    return allAnnotations.filter((a) => dueKeys.has(a.key));
  }, [entries, now, allAnnotations]);

  const [revealed, setRevealed] = useState(false);
  const [index, setIndex] = useState(0);
  const [done, setDone] = useState(0);

  useEffect(() => {
    setRevealed(false);
  }, [index]);

  if (dueQueue.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-sm text-muted-foreground">
          <p>No reviews due right now.</p>
          <p className="mt-2">
            <Link href="/" className="underline underline-offset-4">Back to concepts</Link>
          </p>
        </CardContent>
      </Card>
    );
  }

  const current = dueQueue[Math.min(index, dueQueue.length - 1)];
  const finished = done >= dueQueue.length;

  function grade(outcome: "again" | "good") {
    studyStore.review(current.key, outcome);
    setDone((d) => d + 1);
    if (index + 1 < dueQueue.length) {
      setIndex(index + 1);
    } else {
      setIndex(dueQueue.length); // sentinel
    }
  }

  if (finished) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-sm">
          <p className="text-base font-medium">Done — {done} reviewed.</p>
          <p className="mt-2 text-muted-foreground">
            Next review batch will surface as items become due.
          </p>
          <p className="mt-4">
            <Link href="/" className="underline underline-offset-4">Back to concepts</Link>
          </p>
        </CardContent>
      </Card>
    );
  }

  const accent = kindColor(current.kind);
  const due = entries.find((e) => e.key === current.key);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between text-xs text-muted-foreground">
        <span>{index + 1} of {dueQueue.length}</span>
        {due && <span>box {due.box} · last seen {due.lastReviewedAt ? formatRelativeDue(due.lastReviewedAt) : "never"}</span>}
      </div>

      <Card>
        <CardContent className="p-6">
          <div className="mb-3 flex items-center gap-2">
            <span
              className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide"
              style={{
                color: accent,
                backgroundColor: `color-mix(in oklab, ${accent} 12%, transparent)`,
                borderColor: `color-mix(in oklab, ${accent} 32%, transparent)`,
                border: "1px solid",
              }}
            >
              {ANNOTATION_KIND_LABEL[current.kind]}
            </span>
            <Badge variant="outline" className="text-[10px] font-normal">{current.title}</Badge>
            <code className="font-mono text-[10px] text-muted-foreground">{current.annotId}</code>
          </div>

          <pre className="mt-3 overflow-x-auto rounded-md bg-muted px-4 py-3 font-mono text-[12px] leading-snug">
{current.codeSnippet}
          </pre>

          <p className="mt-4 text-sm text-muted-foreground">
            What is this doing — and why does it matter? Predict in your head, then reveal.
          </p>

          {!revealed ? (
            <div className="mt-4">
              <button
                type="button"
                onClick={() => setRevealed(true)}
                className="inline-flex items-center rounded-md bg-foreground px-3 py-1.5 text-sm text-background transition-colors hover:bg-foreground/90"
              >
                Reveal answer
              </button>
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              {current.remember && (
                <p className="text-base font-medium leading-snug" style={{ color: accent }}>
                  {current.remember}
                </p>
              )}
              {current.tip && (
                <p className="text-sm text-foreground/80">{current.tip}</p>
              )}
              {current.body && (
                <p className="text-sm leading-relaxed text-foreground/80">{current.body}</p>
              )}

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => grade("again")}
                  className="rounded-md border border-border bg-background px-3 py-1.5 text-sm transition-colors hover:bg-muted"
                >
                  Review again
                </button>
                <button
                  type="button"
                  onClick={() => grade("good")}
                  className="rounded-md bg-foreground px-3 py-1.5 text-sm text-background transition-colors hover:bg-foreground/90"
                >
                  Got it →
                </button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function kindColor(kind: AnnotationKind): string {
  switch (kind) {
    case "core": return "var(--annot-core)";
    case "gotcha": return "var(--annot-gotcha)";
    case "mistake": return "var(--annot-mistake)";
    case "mnemonic": return "var(--annot-mnemonic)";
    case "cross": return "var(--annot-cross)";
    default: return "var(--annot-note)";
  }
}
