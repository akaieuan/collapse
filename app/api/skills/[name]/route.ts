import "server-only";
import os from "node:os";
import path from "node:path";
import { promises as fs } from "node:fs";
import { NextResponse } from "next/server";
import { z } from "zod";
import matter from "gray-matter";
import { renderSkillFile } from "@/lib/skill-template";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SKILLS_ROOT = path.join(os.homedir(), ".claude", "skills");

const NAME_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const PutSchema = z.object({
  description: z.string().min(1).max(2048),
  body: z.string().min(1).max(50_000),
});

function localOnly(req: Request): boolean {
  if (process.env.NODE_ENV !== "production") return true;
  const host = req.headers.get("host") ?? "";
  return host.startsWith("localhost") || host.startsWith("127.0.0.1");
}

function safePaths(name: string): { dir: string; file: string } | null {
  if (!NAME_RE.test(name)) return null;
  const dir = path.join(SKILLS_ROOT, name);
  const file = path.join(dir, "SKILL.md");
  const root = SKILLS_ROOT + path.sep;
  if (!dir.startsWith(root)) return null;
  return { dir, file };
}

async function pathExists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ name: string }> },
) {
  if (!localOnly(req)) {
    return NextResponse.json({ ok: false, error: "remote_blocked" }, { status: 403 });
  }
  const { name } = await params;
  const paths = safePaths(name);
  if (!paths) {
    return NextResponse.json({ ok: false, error: "invalid_name" }, { status: 400 });
  }
  if (!(await pathExists(paths.file))) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }
  try {
    const raw = await fs.readFile(paths.file, "utf8");
    const { data, content } = matter(raw);
    return NextResponse.json({
      ok: true,
      name: typeof data.name === "string" ? data.name : name,
      description: typeof data.description === "string" ? data.description : "",
      body: content.trimEnd(),
      path: paths.file,
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: "read_failed", message: (err as Error).message },
      { status: 500 },
    );
  }
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ name: string }> },
) {
  if (!localOnly(req)) {
    return NextResponse.json({ ok: false, error: "remote_blocked" }, { status: 403 });
  }
  const { name } = await params;
  const paths = safePaths(name);
  if (!paths) {
    return NextResponse.json({ ok: false, error: "invalid_name" }, { status: 400 });
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }
  const parsed = PutSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "invalid_request", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  if (!(await pathExists(paths.file))) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }

  const rendered = renderSkillFile({
    name,
    description: parsed.data.description,
    body: parsed.data.body,
  });

  try {
    await fs.mkdir(paths.dir, { recursive: true });
    const tmp = paths.file + ".tmp";
    await fs.writeFile(tmp, rendered, "utf8");
    await fs.rename(tmp, paths.file);
    return NextResponse.json({ ok: true, name, path: paths.file });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: "write_failed", message: (err as Error).message },
      { status: 500 },
    );
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ name: string }> },
) {
  if (!localOnly(req)) {
    return NextResponse.json({ ok: false, error: "remote_blocked" }, { status: 403 });
  }
  const { name } = await params;
  const paths = safePaths(name);
  if (!paths) {
    return NextResponse.json({ ok: false, error: "invalid_name" }, { status: 400 });
  }
  if (!(await pathExists(paths.file))) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }
  try {
    await fs.rm(paths.dir, { recursive: true, force: true });
    return NextResponse.json({ ok: true, name });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: "delete_failed", message: (err as Error).message },
      { status: 500 },
    );
  }
}
