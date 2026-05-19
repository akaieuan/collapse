import type { Admonition, AdmonitionKind } from "./types";

const VALID_KINDS = new Set<AdmonitionKind>([
  "note",
  "tip",
  "warning",
  "important",
  "caution",
  "seealso",
  "attention",
  "danger",
]);

const COLON_FENCE = /^(:{3,})\{(\w+)\}(?:[ \t]+(.+))?\r?\n([\s\S]*?)\r?\n\1[ \t]*$/gm;
const BACKTICK_FENCE = /^(`{3,})\{(\w+)\}(?:[ \t]+(.+))?\r?\n([\s\S]*?)\r?\n\1[ \t]*$/gm;

export function extractAdmonitions(markdown: string): Admonition[] {
  const out: Admonition[] = [];
  for (const re of [COLON_FENCE, BACKTICK_FENCE]) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(markdown)) !== null) {
      const kind = m[2].toLowerCase();
      if (!VALID_KINDS.has(kind as AdmonitionKind)) continue;
      out.push({
        kind: kind as AdmonitionKind,
        title: m[3]?.trim() || undefined,
        body: m[4].trim(),
      });
    }
  }
  return out;
}
