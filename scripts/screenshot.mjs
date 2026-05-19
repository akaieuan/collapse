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
        "# Bell pair preparation\n\nA Bell pair is the simplest entangled state — the foundational building block of every quantum communication protocol.\n\n:::{important} Entanglement is the channel\nWithout the Bell pair there is no way to transmit information from Alice to Bob using just two classical bits. The entanglement is the *resource* that makes teleportation work.\n:::",
    },
    {
      cell_type: "code",
      source:
        "from qiskit import QuantumCircuit\n\nqc = QuantumCircuit(2, 2)\nqc.h(0)        # put qubit 0 in superposition\nqc.cx(0, 1)    # entangle qubit 1 with qubit 0\nqc.measure([0, 1], [0, 1])",
    },
    {
      cell_type: "markdown",
      source:
        ":::{tip}\nIn the noiseless limit, measurement outcomes are perfectly correlated — both 00 or both 11, never mixed.\n:::",
    },
    {
      cell_type: "code",
      source:
        "from qiskit_aer import AerSimulator\nsim = AerSimulator()\njob = sim.run(qc, shots=4096)\ncounts = job.result().get_counts()",
    },
  ],
  metadata: { kernelspec: { language: "python", name: "python3" } },
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
for (const path of ["/", "/concepts/quantum-audio-encoding/grid", "/concepts/reactivity/grid", "/concepts/quantum-audio-encoding", "/import", "/skills"]) {
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

// 02 — cross-stack lesson grid view (Qiskit-primary, shows the quantum/JS bridge)
await snap("02-lesson-grid", "/concepts/quantum-audio-encoding/grid");

// 06 — Vue-primary cross-stack lesson (the "I'm building a Vue/Nuxt skill" beat)
await snap("06-lesson-grid-vue", "/concepts/reactivity/grid");

// 03 — lesson page (tabs view) showing the annotation system
await snap("03-lesson", "/concepts/quantum-audio-encoding", async (page) => {
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
    hasText: "from qiskit import QuantumCircuit",
  }).first();
  await codeCell.click();
  await page.waitForTimeout(800); // let prefill toast appear
});

// 05 — skills directory
await snap("05-skills", "/skills");

await browser.close();
console.log(`\nSaved to ${OUT}`);
