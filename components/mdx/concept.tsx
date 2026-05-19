import type { ReactNode } from "react";

export function Concept({ children }: { children: ReactNode }) {
  return <div className="moth-concept">{children}</div>;
}

export function Note() {
  return null;
}

export function Detail() {
  return null;
}

export function CrossRef() {
  return null;
}
