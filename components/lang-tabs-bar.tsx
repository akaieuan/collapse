"use client";

import { useEffect, useRef } from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LANG_LABELS, type LangKey } from "@/lib/lessons/types";
import { useLesson } from "./lesson-provider";

const LANG_ORDER: LangKey[] = ["next", "vue", "nuxt", "qiskit"];

export function LangTabsBar() {
  const { lesson, activeLang, setActiveLang } = useLesson();
  const langs = LANG_ORDER.filter((l) => lesson.frontmatter.languages.includes(l));
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = document.querySelector(".moth-tabs-mode");
    if (!root) return;
    root.querySelectorAll<HTMLElement>("[data-lang-tab]").forEach((el) => {
      el.dataset.active = el.dataset.langTab === activeLang ? "true" : "false";
    });
  }, [activeLang, lesson.frontmatter.slug]);

  return (
    <div
      ref={containerRef}
      className="sticky top-14 z-20 -mx-1 mb-3 bg-background/90 px-1 py-1.5 backdrop-blur"
    >
      <Tabs value={activeLang} onValueChange={(v) => setActiveLang(v as LangKey)}>
        <TabsList className="h-auto gap-0 rounded border border-border bg-card p-0.5">
          {langs.map((l) => (
            <TabsTrigger
              key={l}
              value={l}
              className="h-6 rounded-[3px] px-2 font-mono text-[10.5px] uppercase tracking-[0.1em] text-muted-foreground transition-colors data-[state=active]:bg-foreground data-[state=active]:text-background data-[state=active]:shadow-none"
            >
              {LANG_LABELS[l]}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
    </div>
  );
}
