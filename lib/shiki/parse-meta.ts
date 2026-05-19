export type AnnotAnchor = { lines: number[]; id: string };

export function parseAnnotMeta(meta: string | undefined | null): AnnotAnchor[] {
  if (!meta) return [];
  const anchors: AnnotAnchor[] = [];
  const blockRegex = /\{([^}]+)\}/g;
  for (const blockMatch of meta.matchAll(blockRegex)) {
    const body = blockMatch[1].trim();
    if (!body) continue;
    for (const part of body.split(/\s+/)) {
      const hashIdx = part.indexOf("#");
      if (hashIdx <= 0) continue;
      const linesPart = part.slice(0, hashIdx);
      const id = part.slice(hashIdx + 1);
      if (!id || !linesPart) continue;
      if (!/^[a-z0-9][a-z0-9-]*$/i.test(id)) continue;
      const lines = parseLinesSpec(linesPart);
      if (lines.length === 0) continue;
      anchors.push({ lines, id });
    }
  }
  return anchors;
}

function parseLinesSpec(spec: string): number[] {
  const out = new Set<number>();
  for (const segment of spec.split(",")) {
    const trimmed = segment.trim();
    if (!trimmed) continue;
    const range = trimmed.match(/^(\d+)-(\d+)$/);
    if (range) {
      const a = Number.parseInt(range[1], 10);
      const b = Number.parseInt(range[2], 10);
      if (a > 0 && b >= a && b - a < 1000) {
        for (let i = a; i <= b; i++) out.add(i);
      }
      continue;
    }
    const single = trimmed.match(/^(\d+)$/);
    if (single) {
      const n = Number.parseInt(single[1], 10);
      if (n > 0) out.add(n);
    }
  }
  return [...out].sort((a, b) => a - b);
}

export function buildLineMap(anchors: AnnotAnchor[]): Map<number, string> {
  const map = new Map<number, string>();
  for (const anchor of anchors) {
    for (const line of anchor.lines) {
      if (!map.has(line)) map.set(line, anchor.id);
    }
  }
  return map;
}

export function extractAttr(meta: string | undefined | null, attr: string): string | undefined {
  if (!meta) return undefined;
  const re = new RegExp(`${attr}="([^"]*)"`);
  const m = meta.match(re);
  return m?.[1];
}
