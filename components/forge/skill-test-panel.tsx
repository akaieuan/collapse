"use client";

import { useState } from "react";
import { toast } from "sonner";
import { forgeStore } from "@/lib/forge/store";

type Mode = "trigger" | "apply";

type TriggerResult = {
  ok: true;
  mode: "trigger";
  triggered: boolean;
  confidence: number;
  reasoning: string;
};

type ApplyResult = {
  ok: true;
  mode: "apply";
  response: string;
  usedSkill: "yes" | "no" | "partial";
};

type Result = TriggerResult | ApplyResult;

type ErrorResult = {
  ok: false;
  error: string;
  message?: string;
};

export function SkillTestPanel({
  draftId,
  description,
  body,
  history = [],
}: {
  draftId: string;
  description: string;
  body: string;
  history?: string[];
}) {
  const [mode, setMode] = useState<Mode>("trigger");
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function run() {
    if (!prompt.trim()) return;
    setBusy(true);
    setResult(null);
    setErrorMsg(null);
    try {
      const res = await fetch("/api/skills/test", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ description, body, userPrompt: prompt, mode }),
      });
      const data = (await res.json()) as Result | ErrorResult;
      if (!data.ok) {
        const msg = friendlyError(data.error, data.message);
        setErrorMsg(msg);
        toast.error(msg);
        return;
      }
      setResult(data);
      forgeStore.pushTestPrompt(draftId, prompt);
    } catch (err) {
      const msg = (err as Error).message;
      setErrorMsg(msg);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-md border border-border bg-muted/30 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
          Test prompt
        </p>
        <div className="inline-flex h-6 items-center rounded border border-border bg-background p-0.5 font-mono text-[10px]">
          <ModeChip current={mode} value="trigger" onPick={setMode}>
            Trigger
          </ModeChip>
          <ModeChip current={mode} value="apply" onPick={setMode}>
            Apply
          </ModeChip>
        </div>
      </div>

      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder={
          mode === "trigger"
            ? `e.g. "how do I make a controlled input in React"`
            : `e.g. "give me a controlled input with name and email fields"`
        }
        rows={2}
        className="w-full rounded border border-border bg-background px-2 py-1.5 text-[12.5px] leading-snug placeholder:text-muted-foreground/60"
      />

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={run}
          disabled={busy || !prompt.trim()}
          className="inline-flex h-7 items-center rounded bg-foreground px-2.5 font-mono text-[10.5px] uppercase tracking-[0.08em] text-background transition-colors enabled:hover:bg-foreground/85 disabled:opacity-40"
        >
          {busy ? "Testing…" : `Test ${mode}`}
        </button>
        {history.length > 0 && (
          <details className="ml-1 text-[11px] text-muted-foreground">
            <summary className="cursor-pointer select-none font-mono uppercase tracking-[0.08em] hover:text-foreground">
              Recent ({history.length})
            </summary>
            <ul className="mt-1 space-y-0.5">
              {history.map((p, i) => (
                <li key={i}>
                  <button
                    type="button"
                    onClick={() => setPrompt(p)}
                    className="block w-full truncate rounded px-1.5 py-1 text-left text-[11px] text-foreground/75 transition-colors hover:bg-muted hover:text-foreground"
                    title={p}
                  >
                    {p}
                  </button>
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>

      {errorMsg && (
        <p className="mt-2 rounded border border-destructive/40 bg-destructive/10 px-2 py-1.5 text-[11px] text-destructive">
          {errorMsg}
        </p>
      )}

      {result && result.mode === "trigger" && (
        <TriggerCard result={result} />
      )}
      {result && result.mode === "apply" && <ApplyCard result={result} />}
    </div>
  );
}

function ModeChip({
  current,
  value,
  onPick,
  children,
}: {
  current: Mode;
  value: Mode;
  onPick: (m: Mode) => void;
  children: React.ReactNode;
}) {
  const active = current === value;
  return (
    <button
      type="button"
      onClick={() => onPick(value)}
      className={
        "inline-flex h-5 items-center rounded-[3px] px-2 uppercase tracking-[0.08em] transition-colors " +
        (active
          ? "bg-foreground text-background"
          : "text-muted-foreground hover:bg-muted hover:text-foreground")
      }
    >
      {children}
    </button>
  );
}

function TriggerCard({ result }: { result: TriggerResult }) {
  const tone = result.triggered
    ? "border-emerald-500/40 bg-emerald-500/8 text-emerald-700 dark:text-emerald-300"
    : "border-border bg-muted/40 text-foreground/80";
  return (
    <div className={`mt-3 rounded border p-2.5 ${tone}`}>
      <div className="flex items-center gap-2">
        <span className="font-mono text-[10px] uppercase tracking-[0.14em]">
          {result.triggered ? "✓ Would trigger" : "✗ Wouldn't trigger"}
        </span>
        <span className="ml-auto font-mono text-[10px] tabular-nums text-muted-foreground">
          conf {Math.round(result.confidence * 100)}%
        </span>
      </div>
      <p className="mt-1.5 text-[12.5px] leading-relaxed text-foreground/85">
        {result.reasoning}
      </p>
    </div>
  );
}

function ApplyCard({ result }: { result: ApplyResult }) {
  const usageLabel = {
    yes: "✓ Used the skill",
    partial: "~ Partially used",
    no: "✗ Did not use",
  }[result.usedSkill];
  return (
    <div className="mt-3 rounded border border-border bg-background p-2.5">
      <div className="mb-1.5 flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
        <span>Claude response</span>
        <span>{usageLabel}</span>
      </div>
      <pre className="max-h-80 overflow-y-auto whitespace-pre-wrap rounded bg-muted/40 p-2 text-[12px] leading-relaxed text-foreground/85">
        {result.response}
      </pre>
    </div>
  );
}

function friendlyError(code: string, message?: string): string {
  switch (code) {
    case "missing_api_key":
      return "Set ANTHROPIC_API_KEY in .env.local and restart the dev server.";
    case "invalid_api_key":
      return "ANTHROPIC_API_KEY rejected by the API. Check the key in .env.local.";
    case "rate_limited":
      return "Rate limited by the Anthropic API. Wait a moment and try again.";
    case "invalid_response":
      return `Model returned malformed JSON. ${message ? `Detail: ${message}` : ""}`.trim();
    case "remote_blocked":
      return "Test API is local-only. Run on localhost.";
    default:
      return message || `Test failed (${code}).`;
  }
}
