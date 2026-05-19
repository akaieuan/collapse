"use client";

import { useState } from "react";
import { toast } from "sonner";

type SharpenResult = { ok: true; suggestion: string; critique: string };
type ErrorResult = { ok: false; error: string; message?: string };

export function DescriptionSharpener({
  description,
  body,
  onApply,
}: {
  description: string;
  body: string;
  onApply: (next: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<SharpenResult | null>(null);

  async function run() {
    if (!description.trim() || !body.trim()) {
      toast.error("Description and body are both required to sharpen.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/skills/sharpen", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ description, body }),
      });
      const data = (await res.json()) as SharpenResult | ErrorResult;
      if (!data.ok) {
        toast.error(friendlyError(data.error, data.message));
        return;
      }
      setResult(data);
    } finally {
      setBusy(false);
    }
  }

  function apply() {
    if (!result) return;
    onApply(result.suggestion);
    toast.success("Description replaced — review and collapse when you're ready.");
    setResult(null);
  }

  return (
    <>
      <button
        type="button"
        onClick={run}
        disabled={busy}
        className="inline-flex h-6 items-center gap-1 rounded border border-border bg-background px-2 font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground transition-colors enabled:hover:border-foreground/30 enabled:hover:text-foreground disabled:opacity-40"
      >
        {busy ? "…" : "Sharpen"}
        <span aria-hidden>↗</span>
      </button>

      {result && (
        <div className="mt-2 rounded-md border border-border bg-muted/30 p-3">
          <p className="mb-1 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
            Critique
          </p>
          <p className="text-[12px] leading-relaxed text-foreground/85">{result.critique}</p>

          <p className="mt-3 mb-1 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
            Proposed
          </p>
          <p className="rounded border border-border bg-background p-2 text-[12.5px] leading-relaxed text-foreground/90">
            {result.suggestion}
          </p>

          <div className="mt-2 flex items-center gap-1.5">
            <button
              type="button"
              onClick={apply}
              className="inline-flex h-7 items-center rounded bg-foreground px-2.5 font-mono text-[10.5px] uppercase tracking-[0.08em] text-background transition-colors hover:bg-foreground/85"
            >
              Apply
            </button>
            <button
              type="button"
              onClick={() => setResult(null)}
              className="inline-flex h-7 items-center rounded border border-border bg-background px-2.5 font-mono text-[10.5px] uppercase tracking-[0.08em] text-foreground transition-colors hover:border-foreground/30 hover:bg-muted"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}
    </>
  );
}

function friendlyError(code: string, message?: string): string {
  switch (code) {
    case "missing_api_key":
      return "Set ANTHROPIC_API_KEY in .env.local and restart the dev server.";
    case "invalid_api_key":
      return "ANTHROPIC_API_KEY rejected by the API.";
    case "rate_limited":
      return "Rate limited — wait and try again.";
    default:
      return message || `Sharpen failed (${code}).`;
  }
}
