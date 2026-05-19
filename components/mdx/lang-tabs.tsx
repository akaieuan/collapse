import type { ReactNode } from "react";
import { LANG_LABELS, type LangKey } from "@/lib/lessons/types";

export function LangTab({ lang, children }: { lang: LangKey; children: ReactNode }) {
  return (
    <section
      data-lang-tab={lang}
      className="moth-lang-tab"
      aria-label={`${LANG_LABELS[lang]} example`}
    >
      <div className="moth-lang-tab__heading mb-2 flex items-center gap-2">
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-primary/60" />
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {LANG_LABELS[lang]}
        </span>
      </div>
      <div className="moth-lang-tab__body">{children}</div>
    </section>
  );
}
