import type { ParsedCell, ParsedNotebook } from "./types";
import { extractAdmonitions } from "./extract-admonitions";

const CODE_CELL_RE =
  /^(`{3,})\{code-cell\}(?:[ \t]+(\w+))?[ \t]*\r?\n([\s\S]*?)\r?\n\1[ \t]*$/gm;

export function parseMyst(raw: string): ParsedNotebook {
  const matches: { start: number; end: number; lang?: string; body: string }[] = [];
  CODE_CELL_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = CODE_CELL_RE.exec(raw)) !== null) {
    matches.push({
      start: m.index,
      end: m.index + m[0].length,
      lang: m[2] || undefined,
      body: m[3],
    });
  }

  const cells: ParsedCell[] = [];
  let cursor = 0;
  let detectedLang: string | undefined;

  for (const match of matches) {
    if (match.start > cursor) {
      const md = raw.slice(cursor, match.start).trim();
      if (md) {
        cells.push({
          type: "markdown",
          source: md,
          admonitions: extractAdmonitions(md),
        });
      }
    }
    if (match.body.trim()) {
      cells.push({
        type: "code",
        source: match.body,
        language: match.lang,
        admonitions: [],
      });
      if (!detectedLang && match.lang) detectedLang = match.lang;
    }
    cursor = match.end;
  }
  if (cursor < raw.length) {
    const md = raw.slice(cursor).trim();
    if (md) {
      cells.push({
        type: "markdown",
        source: md,
        admonitions: extractAdmonitions(md),
      });
    }
  }

  return {
    source: "myst",
    language: detectedLang ?? "python",
    title: inferTitle(cells),
    cells,
  };
}

function inferTitle(cells: ParsedCell[]): string | undefined {
  for (const c of cells) {
    if (c.type !== "markdown") continue;
    const stripped = c.source.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, "");
    const h1 = /^#\s+(.+?)\s*$/m.exec(stripped);
    if (h1) return h1[1];
    return undefined;
  }
  return undefined;
}
