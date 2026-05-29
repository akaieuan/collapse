import "server-only";
import path from "node:path";
import { promises as fs } from "node:fs";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-static";

const NOTEBOOK_PATH = path.join(
  process.cwd(),
  "examples",
  "notebooks",
  "bell-pair-preparation.ipynb",
);

export async function GET() {
  try {
    const raw = await fs.readFile(NOTEBOOK_PATH, "utf8");
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
