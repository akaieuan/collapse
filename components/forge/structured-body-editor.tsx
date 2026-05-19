"use client";

import { useEffect, useState } from "react";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  emptyStructuredBody,
  parseStructuredBody,
  serializeStructuredBody,
  type StructuredBody,
} from "@/lib/skill-body";

const SECTIONS: Array<{
  key: keyof Pick<StructuredBody, "whenToUse" | "recipe" | "why" | "notDo">;
  label: string;
  hint: string;
  rows: number;
  mono?: boolean;
}> = [
  {
    key: "whenToUse",
    label: "When to use this",
    hint: "Be specific about file types, frameworks, and trigger phrases. Negative examples help too.",
    rows: 5,
  },
  {
    key: "recipe",
    label: "Recipe",
    hint: "A complete, working code example with comments. This is what Claude reaches for.",
    rows: 12,
    mono: true,
  },
  {
    key: "why",
    label: "Why this works",
    hint: "The mental model — why this is the right shape, what would break if you did it differently.",
    rows: 5,
  },
  {
    key: "notDo",
    label: "What this skill does NOT do",
    hint: "Guardrails: when this skill should NOT fire, or what it deliberately leaves to the caller.",
    rows: 4,
  },
];

export function StructuredBodyEditor({
  draftId,
  body,
  onChange,
}: {
  draftId: string;
  body: string;
  onChange: (next: string) => void;
}) {
  const [sections, setSections] = useState<StructuredBody>(() => parseStructuredBody(body));

  // Reparse when the active draft changes (different id ⇒ new content from the store).
  useEffect(() => {
    setSections(parseStructuredBody(body));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftId]);

  function update<K extends keyof StructuredBody>(key: K, value: StructuredBody[K]) {
    const next = { ...sections, [key]: value };
    setSections(next);
    onChange(serializeStructuredBody(next));
  }

  const hasExtras = Boolean(sections.lead.trim() || sections.rest.trim());

  return (
    <div className="space-y-3">
      {SECTIONS.map((s) => (
        <div key={s.key}>
          <Label
            htmlFor={`section-${s.key}`}
            className="mb-1 block text-[11px] uppercase tracking-wide text-muted-foreground"
          >
            {s.label}
          </Label>
          <Textarea
            id={`section-${s.key}`}
            value={sections[s.key]}
            onChange={(e) => update(s.key, e.target.value)}
            rows={s.rows}
            className={s.mono ? "font-mono text-[11px]" : "text-[12px]"}
            placeholder={s.hint}
          />
        </div>
      ))}

      {hasExtras && (
        <details className="rounded border border-border/70 bg-muted/30 px-3 py-2">
          <summary className="cursor-pointer select-none font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground hover:text-foreground">
            Other content (preserved)
          </summary>
          <div className="mt-2 space-y-3">
            {sections.lead.trim() && (
              <div>
                <Label
                  htmlFor="section-lead"
                  className="mb-1 block text-[11px] uppercase tracking-wide text-muted-foreground"
                >
                  Lead (before sections)
                </Label>
                <Textarea
                  id="section-lead"
                  value={sections.lead}
                  onChange={(e) => update("lead", e.target.value)}
                  rows={3}
                  className="text-[12px]"
                />
              </div>
            )}
            {sections.rest.trim() && (
              <div>
                <Label
                  htmlFor="section-rest"
                  className="mb-1 block text-[11px] uppercase tracking-wide text-muted-foreground"
                >
                  Other markdown (after sections)
                </Label>
                <Textarea
                  id="section-rest"
                  value={sections.rest}
                  onChange={(e) => update("rest", e.target.value)}
                  rows={4}
                  className="font-mono text-[11px]"
                />
              </div>
            )}
          </div>
        </details>
      )}
    </div>
  );
}
