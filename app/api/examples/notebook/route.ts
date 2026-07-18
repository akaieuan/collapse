import "server-only";
import path from "node:path";
import { promises as fs } from "node:fs";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Allow-listed sample notebooks under examples/notebooks/. A single general-purpose
// React-hooks sample — the import demo's default face.
const SAMPLES: Record<string, string> = {
  "use-debounced-value": "use-debounced-value.ipynb",
};
const DEFAULT_SAMPLE = "use-debounced-value";

const NOTEBOOKS_DIR = path.join(process.cwd(), "examples", "notebooks");

export async function GET(req: Request) {
  const name = new URL(req.url).searchParams.get("name") ?? DEFAULT_SAMPLE;
  const file = SAMPLES[name];
  if (!file) {
    return NextResponse.json({ error: "unknown_sample" }, { status: 404 });
  }
  try {
    const raw = await fs.readFile(path.join(NOTEBOOKS_DIR, file), "utf8");
    return new NextResponse(raw, {
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "public, max-age=3600, immutable",
      },
    });
  } catch {
    return NextResponse.json({ error: "notebook_not_found" }, { status: 404 });
  }
}
