"use client";

import type { LintField, LintIssue } from "@/lib/skill-quality";

export function QualityBadges({
  issues,
  field,
}: {
  issues: LintIssue[];
  field: LintField;
}) {
  const filtered = issues.filter((i) => i.field === field);
  if (filtered.length === 0) return null;
  return (
    <ul className="mt-1 space-y-0.5">
      {filtered.map((i) => {
        const tone =
          i.severity === "warn"
            ? "border-destructive/40 bg-destructive/8 text-destructive"
            : "border-warning/40 bg-warning/10 text-warning";
        const label = i.severity === "warn" ? "warn" : "info";
        return (
          <li
            key={i.id}
            className={`flex items-start gap-2 rounded border px-2 py-1 text-[11px] leading-snug ${tone}`}
          >
            <span className="mt-px font-mono text-[9.5px] uppercase tracking-[0.08em] opacity-80">
              {label}
            </span>
            <span className="min-w-0">{i.message}</span>
          </li>
        );
      })}
    </ul>
  );
}

export function QualityDot({
  verdict,
  size = "sm",
}: {
  verdict: "clean" | "info" | "warn";
  size?: "sm" | "md";
}) {
  const cls =
    verdict === "warn"
      ? "bg-destructive"
      : verdict === "info"
        ? "bg-warning"
        : "bg-success/70";
  const dim = size === "md" ? "h-2 w-2" : "h-1.5 w-1.5";
  const label =
    verdict === "warn" ? "Has warnings" : verdict === "info" ? "Has info" : "Clean";
  return (
    <span
      aria-label={label}
      title={label}
      className={`inline-block rounded-full ${dim} ${cls}`}
    />
  );
}
