/**
 * Capture README screenshots from the running dev server.
 *
 * Usage:
 *   PORT=54678 node scripts/screenshot.mjs
 *   pnpm screenshots
 *
 * Requires the dev server to be running. Outputs PNGs to public/screenshots/.
 */
import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";

const PORT = process.env.PORT || "54678";
const BASE = `http://localhost:${PORT}`;
const OUT = resolve("public/screenshots");

await mkdir(OUT, { recursive: true });

const TEST_NOTEBOOK = JSON.stringify({
  cells: [
    {
      cell_type: "markdown",
      source:
        "# useDebouncedValue hook\n\nA tiny React hook that delays a fast-changing value until it stops changing.\n\n:::{important} Cleanup is the whole trick\nThe returned cleanup clears the pending timer before the next run, so only the latest value ever lands.\n:::",
    },
    {
      cell_type: "code",
      source:
        'import { useEffect, useState } from "react";\n\nexport function useDebouncedValue(value, delay) {\n  const [d, setD] = useState(value);\n  useEffect(() => {\n    const id = setTimeout(() => setD(value), delay);\n    return () => clearTimeout(id);\n  }, [value, delay]);\n  return d;\n}',
    },
    {
      cell_type: "markdown",
      source:
        ":::{tip}\nDebounce the value, not the handler — keep the input controlled and derive a debounced copy.\n:::",
    },
    {
      cell_type: "code",
      source:
        'function SearchBox() {\n  const [q, setQ] = useState("");\n  const debounced = useDebouncedValue(q, 300);\n  useEffect(() => { if (debounced) void fetch(`/api/search?q=${debounced}`); }, [debounced]);\n  return <input value={q} onChange={(e) => setQ(e.target.value)} />;\n}',
    },
  ],
  metadata: { kernelspec: { language: "typescript", name: "tslab" } },
  nbformat: 4,
  nbformat_minor: 5,
});

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  colorScheme: "dark",
  deviceScaleFactor: 2,
  reducedMotion: "no-preference",
});

// Pre-warm dev routes — first request to a Next dev route triggers compile (~5–15s).
// Walking each route once means the screenshot pass hits warm caches.
console.log("Pre-warming routes…");
for (const path of ["/", "/concepts/side-effects/grid", "/concepts/reactivity/grid", "/concepts/side-effects", "/import", "/skills"]) {
  const page = await ctx.newPage();
  try {
    await page.goto(BASE + path, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForLoadState("networkidle", { timeout: 30000 }).catch(() => {});
  } catch (err) {
    console.warn(`  ! warm ${path}: ${err.message.split("\n")[0]}`);
  }
  await page.close();
}

async function snap(name, path, prep) {
  const page = await ctx.newPage();
  await page.goto(BASE + path, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForLoadState("networkidle", { timeout: 30000 }).catch(() => {});
  if (prep) await prep(page);
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: false });
  await page.close();
  console.log(`✓ ${name}.png`);
}

// 01 — homepage / concepts index
await snap("01-home", "/");

// 02 — cross-stack lesson grid view (a side-effectful pattern across stacks)
await snap("02-lesson-grid", "/concepts/side-effects/grid");

// 06 — Vue-primary cross-stack lesson (the "I'm building a Vue/Nuxt skill" beat)
await snap("06-lesson-grid-vue", "/concepts/reactivity/grid");

// 03 — lesson page (tabs view) showing the annotation system
await snap("03-lesson", "/concepts/side-effects", async (page) => {
  // Click an annotated span to pin its note (color-coded reveal)
  const annot = page.locator(".annot").first();
  if (await annot.count()) {
    await annot.hover();
    await page.waitForTimeout(300);
  }
});

// 04 — /import mid-flow: parsed notebook, selected cell, admonition prefill
await snap("04-import", "/import", async (page) => {
  await page.waitForSelector("textarea", { timeout: 30000 });
  await page.fill("textarea", TEST_NOTEBOOK);
  await page.getByRole("button", { name: "Parse" }).click();
  await page.waitForTimeout(500);
  const codeCell = page.locator("button", {
    hasText: "useDebouncedValue",
  }).first();
  await codeCell.click();
  await page.waitForTimeout(800); // let prefill toast appear
});

// 05 — skills directory
await snap("05-skills", "/skills");

await browser.close();
console.log(`\nSaved to ${OUT}`);
