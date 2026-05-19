"use client";

import { useEffect, useRef, useState } from "react";
import { useLesson } from "./lesson-provider";

type Pos = { top: number; left: number; width: number } | null;

export function AnnotationTooltip() {
  const { findAnnotation, activeAnnotationId } = useLesson();
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [pos, setPos] = useState<Pos>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onOver(e: MouseEvent) {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      const annot = target.closest("[data-annot-id]") as HTMLElement | null;
      if (!annot) {
        setHoveredId(null);
        setPos(null);
        return;
      }
      const id = annot.getAttribute("data-annot-id");
      if (!id) return;
      const rect = annot.getBoundingClientRect();
      setHoveredId(id);
      setPos({
        top: rect.bottom + window.scrollY + 6,
        left: rect.left + window.scrollX,
        width: rect.width,
      });
    }
    function onLeave() {
      setHoveredId(null);
      setPos(null);
    }
    document.addEventListener("mouseover", onOver);
    document.addEventListener("mouseleave", onLeave);
    window.addEventListener("scroll", onLeave, true);
    return () => {
      document.removeEventListener("mouseover", onOver);
      document.removeEventListener("mouseleave", onLeave);
      window.removeEventListener("scroll", onLeave, true);
    };
  }, []);

  if (!hoveredId || !pos || hoveredId === activeAnnotationId) return null;
  const found = findAnnotation(hoveredId);
  if (!found) return null;
  const heading = found.annotation.remember || found.annotation.tip;
  if (!heading) return null;

  const accent = kindColor(found.annotation.kind);

  return (
    <div
      ref={tooltipRef}
      className="pointer-events-none fixed z-50 max-w-sm rounded-md border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-lg"
      style={{
        top: pos.top - window.scrollY,
        left: pos.left,
        opacity: 0.98,
        borderColor: `color-mix(in oklab, ${accent} 35%, transparent)`,
        borderLeftWidth: 3,
        borderLeftColor: accent,
      }}
      role="tooltip"
    >
      <div className="font-medium leading-snug" style={{ color: accent }}>
        {heading}
      </div>
      {found.annotation.remember && found.annotation.tip && (
        <div className="mt-1 text-[11px] text-foreground/80">{found.annotation.tip}</div>
      )}
      <div className="mt-1 text-[10px] uppercase tracking-wide text-muted-foreground">
        Click to pin
      </div>
    </div>
  );
}

function kindColor(kind: string): string {
  switch (kind) {
    case "core": return "var(--annot-core)";
    case "gotcha": return "var(--annot-gotcha)";
    case "mistake": return "var(--annot-mistake)";
    case "mnemonic": return "var(--annot-mnemonic)";
    case "cross": return "var(--annot-cross)";
    default: return "var(--annot-note)";
  }
}
