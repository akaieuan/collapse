/**
 * End-to-end: the /import notebook → skill flow.
 *
 * Drives a real browser through the whole ingest path:
 *   paste a small inline .ipynb JSON fixture → Parse → pick the code cell →
 *   annotation prefill lands from the preceding MyST admonition → Generate draft →
 *   Collapse (POST /api/skills).
 *
 * The POST /api/skills write is INTERCEPTED at the network layer and fulfilled with a
 * mock 201 — the Next.js route handler never runs, so nothing is ever written to the real
 * ~/.claude/skills. A post-run filesystem check asserts the target SKILL.md does not exist.
 *
 * Usage:
 *   pnpm test:e2e                       # spawns `next dev` itself, then tears it down
 *   E2E_BASE_URL=http://127.0.0.1:3000 pnpm test:e2e   # run against an already-running server
 *
 * Uses the `playwright` package directly (same idiom as scripts/screenshot.mjs) — no
 * @playwright/test dependency. Requires the chromium browser (`playwright install chromium`).
 */
import { chromium } from "playwright";
import { spawn } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { access } from "node:fs/promises";

const PORT = process.env.E2E_PORT || "54981";
// Use `localhost` (not 127.0.0.1): Next 16 dev blocks cross-origin dev resources, and the
// dev server reports its origin as localhost — a 127.0.0.1 origin blocks the client bundle.
const BASE = process.env.E2E_BASE_URL || `http://localhost:${PORT}`;
const OWN_SERVER = !process.env.E2E_BASE_URL;

// The derived skill name for the fixture below (lang `next` + annotation id).
const EXPECTED_SKILL_NAME = "next-cleanup-is-the-whole-trick";
const TARGET_SKILL_FILE = path.join(
  os.homedir(),
  ".claude",
  "skills",
  EXPECTED_SKILL_NAME,
  "SKILL.md",
);

// Small inline notebook: a MyST admonition (with a title) immediately before a code cell.
// Selecting the code cell should prefill the annotation from that admonition.
const NOTEBOOK = JSON.stringify({
  cells: [
    {
      cell_type: "markdown",
      source:
        ":::{important} Cleanup is the whole trick\nThe returned cleanup clears the pending timer before the next run.\n:::",
    },
    {
      cell_type: "code",
      source:
        'import { useEffect, useState } from "react";\n\nexport function useDebouncedValue(value, delay) {\n  const [d, setD] = useState(value);\n  useEffect(() => {\n    const id = setTimeout(() => setD(value), delay);\n    return () => clearTimeout(id);\n  }, [value, delay]);\n  return d;\n}',
    },
  ],
  metadata: { kernelspec: { language: "typescript" } },
});

function log(msg) {
  process.stdout.write(`[e2e] ${msg}\n`);
}

function assert(cond, msg) {
  if (!cond) throw new Error(`Assertion failed: ${msg}`);
}

async function pathExists(p) {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

async function waitForServer(url, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url, { redirect: "manual" });
      if (res.status < 500) return;
    } catch {
      // server not up yet
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Server did not become ready at ${url} within ${timeoutMs}ms`);
}

async function run() {
  // Guard: the real skill must not already exist (would mask a genuine write).
  assert(
    !(await pathExists(TARGET_SKILL_FILE)),
    `real skill file already exists at ${TARGET_SKILL_FILE} — remove it before running the e2e`,
  );

  let server = null;
  if (OWN_SERVER) {
    log(`starting dev server on port ${PORT}…`);
    server = spawn("pnpm", ["exec", "next", "dev", "-p", PORT], {
      stdio: "inherit",
      detached: true,
      env: { ...process.env },
    });
  }

  const browser = await chromium.launch();
  try {
    await waitForServer(`${BASE}/import`, 180_000);
    log("server ready");

    const page = await browser.newPage();

    let intercepted = false;
    let capturedBody = null;
    await page.route("**/api/skills", async (route) => {
      const req = route.request();
      if (req.method() === "POST") {
        intercepted = true;
        try {
          capturedBody = JSON.parse(req.postData() || "{}");
        } catch {
          capturedBody = null;
        }
        // Fulfil here → the real route handler never runs → no filesystem write.
        await route.fulfill({
          status: 201,
          contentType: "application/json",
          body: JSON.stringify({
            name: capturedBody?.name,
            path: `~/.claude/skills/${capturedBody?.name}/SKILL.md`,
          }),
        });
      } else {
        await route.continue();
      }
    });

    log("loading /import");
    await page.goto(`${BASE}/import`, { waitUntil: "domcontentloaded" });

    // Stage 1: paste the notebook and parse.
    await page.locator("textarea").first().fill(NOTEBOOK);
    await page.getByRole("button", { name: "Parse", exact: true }).click();

    // Stage 2: the cell list renders. Pick the code cell.
    // The cell row shows the cell's first non-empty line (the import), so match on that.
    const codeCell = page
      .getByRole("button")
      .filter({ hasText: "useEffect" });
    await codeCell.first().waitFor({ timeout: 15_000 });
    await codeCell.first().click();

    // Annotation prefill must land from the preceding MyST admonition.
    await page
      .getByText("Pre-filled from a MyST admonition", { exact: false })
      .waitFor({ timeout: 10_000 });
    const tipValue = await page
      .getByPlaceholder("clearTimeout(id) cancels the pending update")
      .inputValue();
    assert(
      tipValue === "Cleanup is the whole trick",
      `expected prefilled tip, got "${tipValue}"`,
    );
    const bodyValue = await page
      .getByPlaceholder("Why this pattern works in plain language…")
      .inputValue();
    assert(bodyValue.length > 0, "expected prefilled annotation body");
    log("annotation prefill verified");

    // Generate the draft.
    await page
      .getByRole("button", { name: "Generate skill draft", exact: true })
      .click();

    // Stage 3: the draft is generated.
    await page.getByText("Collapse to skill", { exact: false }).waitFor({ timeout: 10_000 });
    log("draft generated");

    // Collapse → POST /api/skills (intercepted).
    await page.getByRole("button", { name: "Collapse", exact: true }).click();
    await page.getByText(/Collapsed →/).waitFor({ timeout: 10_000 });

    // Verify the intercepted write payload.
    assert(intercepted, "POST /api/skills was not intercepted");
    assert(capturedBody !== null, "could not read the POST body");
    assert(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(capturedBody.name),
      `skill name is not kebab-case: "${capturedBody.name}"`,
    );
    assert(
      capturedBody.name === EXPECTED_SKILL_NAME,
      `expected skill name "${EXPECTED_SKILL_NAME}", got "${capturedBody.name}"`,
    );
    assert(
      typeof capturedBody.description === "string" && capturedBody.description.length > 0,
      "POST body missing description",
    );
    assert(
      typeof capturedBody.body === "string" && capturedBody.body.length > 0,
      "POST body missing body",
    );
    log("POST /api/skills payload verified");

    // The real filesystem must be untouched.
    assert(
      !(await pathExists(TARGET_SKILL_FILE)),
      `real skill file was written at ${TARGET_SKILL_FILE} — interception failed`,
    );
    log("no real ~/.claude/skills write — OK");

    log("PASS");
  } finally {
    await browser.close();
    if (server && server.pid) {
      try {
        // Kill the whole process group (next dev spawns children).
        process.kill(-server.pid, "SIGTERM");
      } catch {
        try {
          server.kill("SIGTERM");
        } catch {
          // already gone
        }
      }
    }
  }
}

run().then(
  () => process.exit(0),
  (err) => {
    process.stderr.write(`[e2e] FAIL: ${err?.stack || err}\n`);
    process.exit(1);
  },
);
