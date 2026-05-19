"use client";

import { useEffect, useState } from "react";

export type ForgeDraft = {
  id: string;
  createdAt: number;
  updatedAt: number;
  source: ForgeSource;
  title: string;
  name: string;
  description: string;
  body: string;
  status: "draft" | "saved";
  saved?: { name: string; path: string; at: number };
  testHistory?: string[];
};

export type ForgeSource =
  | { kind: "concept"; slug: string; conceptTitle: string }
  | { kind: "edit"; existingName: string; path: string }
  | { kind: "manual" };

const STORAGE_KEY = "collapse.forge.v1";

type Listener = () => void;

function loadAll(): ForgeDraft[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) return [];
    return arr.filter(isForgeDraft);
  } catch {
    return [];
  }
}

function isForgeDraft(v: unknown): v is ForgeDraft {
  if (!v || typeof v !== "object") return false;
  const d = v as Partial<ForgeDraft>;
  return typeof d.id === "string" && typeof d.title === "string" && typeof d.body === "string";
}

class ForgeStore {
  private listeners = new Set<Listener>();

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  private notify() {
    this.listeners.forEach((l) => l());
  }

  read(): ForgeDraft[] {
    return loadAll();
  }

  private write(next: ForgeDraft[]) {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // ignore quota errors
    }
    this.notify();
  }

  capture(input: Omit<ForgeDraft, "id" | "createdAt" | "updatedAt" | "status">): ForgeDraft {
    const id = `forge_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const draft: ForgeDraft = {
      ...input,
      id,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      status: "draft",
    };
    const next = [draft, ...this.read()].slice(0, 50);
    this.write(next);
    return draft;
  }

  update(id: string, patch: Partial<Pick<ForgeDraft, "title" | "name" | "description" | "body">>) {
    const next = this.read().map((d) =>
      d.id === id ? { ...d, ...patch, updatedAt: Date.now() } : d,
    );
    this.write(next);
  }

  markSaved(id: string, saved: NonNullable<ForgeDraft["saved"]>) {
    const next: ForgeDraft[] = this.read().map((d) =>
      d.id === id ? { ...d, status: "saved" as const, saved, updatedAt: Date.now() } : d,
    );
    this.write(next);
  }

  remove(id: string) {
    const next = this.read().filter((d) => d.id !== id);
    this.write(next);
  }

  pushTestPrompt(id: string, prompt: string, max = 5) {
    const trimmed = prompt.trim();
    if (!trimmed) return;
    const next = this.read().map((d) => {
      if (d.id !== id) return d;
      const existing = d.testHistory?.filter((p) => p !== trimmed) ?? [];
      const history = [trimmed, ...existing].slice(0, max);
      return { ...d, testHistory: history, updatedAt: Date.now() };
    });
    this.write(next);
  }

  clear() {
    this.write([]);
  }
}

export const forgeStore = new ForgeStore();

export function useForgeDrafts(): ForgeDraft[] {
  const [drafts, setDrafts] = useState<ForgeDraft[]>([]);
  useEffect(() => {
    setDrafts(forgeStore.read());
    return forgeStore.subscribe(() => {
      setDrafts(forgeStore.read());
    });
  }, []);
  return drafts;
}
