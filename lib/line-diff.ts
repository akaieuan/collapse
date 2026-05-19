/**
 * Tiny line-level diff using LCS (Longest Common Subsequence).
 * Quadratic in line count — fine for SKILL.md files (typically <500 lines).
 *
 * Returns a sequence of segments. `same` lines stayed put; `del` lines
 * existed in the previous version and are gone; `add` lines are new.
 */

export type DiffSegment = { type: "same" | "add" | "del"; text: string };

export function lineDiff(prev: string, next: string): DiffSegment[] {
  const a = prev.split("\n");
  const b = next.split("\n");
  const m = a.length;
  const n = b.length;

  // LCS table
  const lcs: number[][] = Array.from({ length: m + 1 }, () =>
    new Array(n + 1).fill(0),
  );
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        lcs[i][j] = lcs[i - 1][j - 1] + 1;
      } else {
        lcs[i][j] = Math.max(lcs[i - 1][j], lcs[i][j - 1]);
      }
    }
  }

  // Walk back to produce the diff
  const out: DiffSegment[] = [];
  let i = m;
  let j = n;
  while (i > 0 && j > 0) {
    if (a[i - 1] === b[j - 1]) {
      out.push({ type: "same", text: a[i - 1] });
      i -= 1;
      j -= 1;
    } else if (lcs[i - 1][j] >= lcs[i][j - 1]) {
      out.push({ type: "del", text: a[i - 1] });
      i -= 1;
    } else {
      out.push({ type: "add", text: b[j - 1] });
      j -= 1;
    }
  }
  while (i > 0) {
    out.push({ type: "del", text: a[i - 1] });
    i -= 1;
  }
  while (j > 0) {
    out.push({ type: "add", text: b[j - 1] });
    j -= 1;
  }
  out.reverse();
  return out;
}

export type DiffStats = { added: number; removed: number; unchanged: number };

export function diffStats(segments: DiffSegment[]): DiffStats {
  let added = 0;
  let removed = 0;
  let unchanged = 0;
  for (const seg of segments) {
    if (seg.type === "add") added += 1;
    else if (seg.type === "del") removed += 1;
    else unchanged += 1;
  }
  return { added, removed, unchanged };
}
