"use client";

import type { ComponentProps } from "react";
import { useLesson } from "@/components/lesson-provider";

type Props = ComponentProps<"pre"> & {
  "data-title"?: string;
  "data-lang"?: string;
};

export function MdxPre(props: Props) {
  const { pinAnnotation } = useLesson();
  const title = props["data-title"];
  const lang = props["data-lang"];

  function onClick(e: React.MouseEvent<HTMLPreElement>) {
    const target = e.target as HTMLElement | null;
    if (!target) return;
    const annot = target.closest("[data-annot-id]");
    if (!annot) return;
    const id = annot.getAttribute("data-annot-id");
    if (id) pinAnnotation(id);
  }

  function onKey(e: React.KeyboardEvent<HTMLPreElement>) {
    if (e.key !== "Enter" && e.key !== " ") return;
    const target = e.target as HTMLElement | null;
    if (!target) return;
    const annot = target.closest("[data-annot-id]");
    if (!annot) return;
    const id = annot.getAttribute("data-annot-id");
    if (id) {
      e.preventDefault();
      pinAnnotation(id);
    }
  }

  return (
    <div className="my-6 overflow-hidden rounded-lg border border-border bg-card">
      {(title || lang) && (
        <div className="flex items-center justify-between border-b border-border bg-muted/40 px-4 py-2 text-[11px] font-mono">
          <span className="text-foreground/80">{title}</span>
          {lang && (
            <span className="text-muted-foreground uppercase tracking-wide">
              {lang}
            </span>
          )}
        </div>
      )}
      <pre
        {...props}
        onClick={onClick}
        onKeyDown={onKey}
        data-annotated-root="true"
        className={`${props.className ?? ""} m-0 rounded-none border-0`}
      />
    </div>
  );
}
