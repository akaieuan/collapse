"use client";

import { useEffect, useState } from "react";

export type StudyEntry = {
  key: string;
  slug: string;
  annotId: string;
  box: number;
  dueAt: number;
  lastReviewedAt: number | null;
  seenCount: number;
  goodCount: number;
  againCount: number;
};

export type ReviewOutcome = "again" | "good";

const STORAGE_KEY = "quantopera.study.v1";
const RECALL_KEY = "quantopera.recall.v1";

const DAY = 24 * 60 * 60 * 1000;
const BOX_INTERVALS_MS = [0, DAY, 3 * DAY, 7 * DAY, 14 * DAY, 30 * DAY];

type Listener = () => void;

function loadAll(): Record<string, StudyEntry> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    return parsed as Record<string, StudyEntry>;
  } catch {
    return {};
  }
}

function saveAll(map: Record<string, StudyEntry>) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    // ignore quota errors
  }
}

function splitKey(key: string): { slug: string; annotId: string } {
  const idx = key.indexOf("#");
  if (idx === -1) return { slug: key, annotId: "" };
  return { slug: key.slice(0, idx), annotId: key.slice(idx + 1) };
}

class StudyStore {
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

  read(): StudyEntry[] {
    return Object.values(loadAll());
  }

  get(key: string): StudyEntry | null {
    return loadAll()[key] ?? null;
  }

  due(now: number = Date.now()): StudyEntry[] {
    return this.read().filter((e) => e.dueAt <= now);
  }

  bySlug(slug: string): StudyEntry[] {
    return this.read().filter((e) => e.slug === slug);
  }

  markSeen(key: string) {
    const map = loadAll();
    const { slug, annotId } = splitKey(key);
    const existing = map[key];
    if (existing) {
      existing.seenCount += 1;
    } else {
      map[key] = {
        key,
        slug,
        annotId,
        box: 0,
        dueAt: Date.now(),
        lastReviewedAt: null,
        seenCount: 1,
        goodCount: 0,
        againCount: 0,
      };
    }
    saveAll(map);
    this.notify();
  }

  review(key: string, outcome: ReviewOutcome, now: number = Date.now()) {
    const map = loadAll();
    const { slug, annotId } = splitKey(key);
    const existing = map[key] ?? {
      key,
      slug,
      annotId,
      box: 0,
      dueAt: now,
      lastReviewedAt: null,
      seenCount: 0,
      goodCount: 0,
      againCount: 0,
    };
    if (outcome === "good") {
      existing.box = Math.min(BOX_INTERVALS_MS.length - 1, existing.box + 1);
      existing.goodCount += 1;
    } else {
      existing.box = Math.max(1, Math.floor(existing.box / 2));
      existing.againCount += 1;
    }
    existing.lastReviewedAt = now;
    existing.dueAt = now + BOX_INTERVALS_MS[existing.box];
    map[key] = existing;
    saveAll(map);
    this.notify();
  }

  remove(key: string) {
    const map = loadAll();
    delete map[key];
    saveAll(map);
    this.notify();
  }

  clear() {
    saveAll({});
    this.notify();
  }

  // Recall mode toggle persisted per-slug
  isRecallOn(slug: string): boolean {
    if (typeof window === "undefined") return false;
    try {
      const raw = window.localStorage.getItem(RECALL_KEY);
      if (!raw) return false;
      const parsed = JSON.parse(raw) as Record<string, boolean>;
      return !!parsed[slug];
    } catch {
      return false;
    }
  }

  setRecall(slug: string, on: boolean) {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(RECALL_KEY);
      const parsed = (raw ? JSON.parse(raw) : {}) as Record<string, boolean>;
      if (on) parsed[slug] = true;
      else delete parsed[slug];
      window.localStorage.setItem(RECALL_KEY, JSON.stringify(parsed));
    } catch {
      // ignore
    }
    this.notify();
  }
}

export const studyStore = new StudyStore();

export function useStudyEntries(): StudyEntry[] {
  const [entries, setEntries] = useState<StudyEntry[]>([]);
  useEffect(() => {
    setEntries(studyStore.read());
    const unsub = studyStore.subscribe(() => setEntries(studyStore.read()));
    return () => { unsub(); };
  }, []);
  return entries;
}

export function useDueCount(): number {
  const entries = useStudyEntries();
  const now = Date.now();
  return entries.filter((e) => e.dueAt <= now).length;
}

export function useRecallMode(slug: string): [boolean, (on: boolean) => void] {
  const [on, setOn] = useState(false);
  useEffect(() => {
    setOn(studyStore.isRecallOn(slug));
    const unsub = studyStore.subscribe(() => setOn(studyStore.isRecallOn(slug)));
    return () => { unsub(); };
  }, [slug]);
  const toggle = (next: boolean) => studyStore.setRecall(slug, next);
  return [on, toggle];
}

export function formatRelativeDue(due: number, now: number = Date.now()): string {
  const diff = due - now;
  if (diff <= 0) return "due now";
  if (diff < 60_000) return "in <1m";
  if (diff < 3_600_000) return `in ${Math.floor(diff / 60_000)}m`;
  if (diff < DAY) return `in ${Math.floor(diff / 3_600_000)}h`;
  return `in ${Math.floor(diff / DAY)}d`;
}
