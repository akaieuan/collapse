export function snippetForAnnotation(
  code: string,
  meta: string,
  id: string,
  contextLines: number = 2,
): string {
  const blockRe = /\{([^}]+)\}/g;
  const lines = code.split("\n");
  for (const block of Array.from(meta.matchAll(blockRe))) {
    for (const part of block[1].trim().split(/\s+/)) {
      const hashIdx = part.indexOf("#");
      if (hashIdx <= 0) continue;
      const linesPart = part.slice(0, hashIdx);
      const partId = part.slice(hashIdx + 1);
      if (partId !== id) continue;
      const range = linesPart.match(/^(\d+)(?:-(\d+))?$/);
      if (!range) continue;
      const start = Math.max(1, Number(range[1]) - contextLines);
      const end = Math.min(lines.length, Number(range[2] ?? range[1]) + contextLines);
      return lines.slice(start - 1, end).join("\n");
    }
  }
  return code.split("\n").slice(0, 8).join("\n");
}
