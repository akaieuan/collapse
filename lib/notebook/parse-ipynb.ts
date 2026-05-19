import type { ParsedCell, ParsedNotebook } from "./types";
import { extractAdmonitions } from "./extract-admonitions";

export class IpynbParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IpynbParseError";
  }
}

type RawCell = {
  cell_type?: unknown;
  source?: unknown;
  metadata?: unknown;
};

type RawNotebook = {
  cells?: unknown;
  metadata?: {
    kernelspec?: { language?: unknown; name?: unknown };
    language_info?: { name?: unknown };
    title?: unknown;
  };
};

export function parseIpynb(raw: string): ParsedNotebook {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch (err) {
    throw new IpynbParseError(
      `Invalid notebook JSON: ${(err as Error).message}`,
    );
  }
  if (!isObject(json) || !Array.isArray((json as RawNotebook).cells)) {
    throw new IpynbParseError(
      "Not a valid Jupyter notebook (missing 'cells' array)",
    );
  }
  const nb = json as RawNotebook;
  const language = inferLanguage(nb);
  const title = inferTitle(nb);

  const cells: ParsedCell[] = [];
  for (const rawCell of nb.cells as RawCell[]) {
    if (!isObject(rawCell)) continue;
    const type = rawCell.cell_type;
    if (type !== "code" && type !== "markdown") continue;
    const source = coerceSource(rawCell.source);
    if (!source.trim()) continue;
    cells.push({
      type,
      source,
      language: type === "code" ? language : undefined,
      admonitions: type === "markdown" ? extractAdmonitions(source) : [],
    });
  }

  return { source: "ipynb", language, title, cells };
}

function inferLanguage(nb: RawNotebook): string {
  const k = nb.metadata?.kernelspec;
  if (k && typeof k.language === "string" && k.language) return k.language;
  if (k && typeof k.name === "string" && k.name) return k.name;
  const li = nb.metadata?.language_info;
  if (li && typeof li.name === "string" && li.name) return li.name;
  return "python";
}

function inferTitle(nb: RawNotebook): string | undefined {
  if (typeof nb.metadata?.title === "string") return nb.metadata.title;
  const cells = (nb.cells as RawCell[]) ?? [];
  for (const c of cells) {
    if (!isObject(c) || c.cell_type !== "markdown") continue;
    const src = coerceSource(c.source);
    const h1 = /^#\s+(.+?)\s*$/m.exec(src);
    if (h1) return h1[1];
    return undefined;
  }
  return undefined;
}

function coerceSource(source: unknown): string {
  if (typeof source === "string") return source;
  if (Array.isArray(source)) return source.map(String).join("");
  return "";
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}
