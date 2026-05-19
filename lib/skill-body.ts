/**
 * Round-trip parser/serializer for the canonical 4-section skill body.
 *
 * Canonical sections (H2 headings, in order):
 *   ## When to use this
 *   ## Recipe
 *   ## Why this works
 *   ## What this skill does NOT do
 *
 * `parseStructuredBody(md)` extracts each section's content (excluding the heading line).
 *   - Anything before the first canonical heading (e.g. an intro paragraph or H1) is collected
 *     into `lead` so it survives a round trip.
 *   - Anything inside an unrecognised H2 (or content after the last canonical heading that
 *     isn't followed by another canonical heading) goes into `rest` — also preserved.
 *
 * `serializeStructuredBody(parsed)` reassembles in canonical order, only emitting a heading
 * if its section has non-empty content. `lead` goes first, then the canonical sections,
 * then `rest` at the end.
 *
 * Pure functions. No Markdown lib needed; the heading match is line-anchored and exact.
 */

export type StructuredBody = {
  lead: string;
  whenToUse: string;
  recipe: string;
  why: string;
  notDo: string;
  rest: string;
};

export const SECTION_HEADINGS = {
  whenToUse: "## When to use this",
  recipe: "## Recipe",
  why: "## Why this works",
  notDo: "## What this skill does NOT do",
} as const;

type SectionKey = keyof typeof SECTION_HEADINGS;
const ORDERED: SectionKey[] = ["whenToUse", "recipe", "why", "notDo"];

const HEADING_RE = /^##\s+(.+?)\s*$/;

const HEADING_MATCH: Record<string, keyof StructuredBody> = {
  "when to use this": "whenToUse",
  "when to use": "whenToUse",
  recipe: "recipe",
  "the recipe": "recipe",
  "why this works": "why",
  "why it works": "why",
  "what this skill does not do": "notDo",
  "what this skill doesn't do": "notDo",
  "what this does not do": "notDo",
};

export function emptyStructuredBody(): StructuredBody {
  return { lead: "", whenToUse: "", recipe: "", why: "", notDo: "", rest: "" };
}

export function parseStructuredBody(md: string): StructuredBody {
  const result = emptyStructuredBody();
  if (!md.trim()) return result;

  const lines = md.split(/\r?\n/);
  type Bucket = keyof StructuredBody;

  let bucket: Bucket = "lead";
  // Buffers per bucket, keyed by bucket name.
  const buffers: Record<Bucket, string[]> = {
    lead: [],
    whenToUse: [],
    recipe: [],
    why: [],
    notDo: [],
    rest: [],
  };

  for (const line of lines) {
    const m = line.match(HEADING_RE);
    if (m) {
      const key = m[1].trim().toLowerCase().replace(/[^\w\s']/g, "");
      const target = HEADING_MATCH[key];
      if (target) {
        bucket = target;
        continue;
      }
      // Unknown H2: dump the heading + its content into `rest`
      bucket = "rest";
      buffers.rest.push(line);
      continue;
    }
    buffers[bucket].push(line);
  }

  for (const k of Object.keys(buffers) as Bucket[]) {
    result[k] = trimEnclosingBlankLines(buffers[k].join("\n"));
  }

  return result;
}

export function serializeStructuredBody(parsed: StructuredBody): string {
  const parts: string[] = [];

  const lead = parsed.lead.trim();
  if (lead) parts.push(lead);

  for (const key of ORDERED) {
    const value = parsed[key].trim();
    if (!value) continue;
    parts.push(`${SECTION_HEADINGS[key]}\n\n${value}`);
  }

  const rest = parsed.rest.trim();
  if (rest) parts.push(rest);

  return parts.join("\n\n") + (parts.length ? "\n" : "");
}

function trimEnclosingBlankLines(s: string): string {
  // Drop leading and trailing all-blank lines, but preserve inner blank lines.
  return s.replace(/^(?:\s*\n)+/, "").replace(/(?:\n\s*)+$/, "");
}

/**
 * Returns true if the body uses any of the canonical headings — i.e. is "structured enough"
 * for the structured editor to round-trip cleanly without merging unknown content into `rest`.
 * Used to decide whether to default the editor to structured mode or fall back to flat.
 */
export function hasCanonicalStructure(md: string): boolean {
  const parsed = parseStructuredBody(md);
  return Boolean(parsed.whenToUse || parsed.recipe || parsed.why || parsed.notDo);
}
