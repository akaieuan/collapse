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

const PostSchema = z.object({
  name: z
    .string()
    .min(1)
    .max(64)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "kebab-case-only"),
  description: z.string().min(1).max(2048),
  body: z.string().min(1).max(50_000),
  overwrite: z.boolean().optional(),
});

function localOnly(req: Request): boolean {
  if (process.env.NODE_ENV !== "production") return true;
  const host = req.headers.get("host") ?? "";
  return host.startsWith("localhost") || host.startsWith("127.0.0.1");
}

function safeSkillPath(name: string): { dir: string; file: string } | null {
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

async function readExisting(file: string) {
  try {
    const raw = await fs.readFile(file, "utf8");
    const { data } = matter(raw);
    return {
      description: typeof data.description === "string" ? data.description : undefined,
      name: typeof data.name === "string" ? data.name : undefined,
    };
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  if (!localOnly(req)) {
    return NextResponse.json({ error: "remote_write_blocked" }, { status: 403 });
  }
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const parsed = PostSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_request", detail: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const { name, description, body, overwrite } = parsed.data;
  const paths = safeSkillPath(name);
  if (!paths) {
    return NextResponse.json({ error: "invalid_path" }, { status: 400 });
  }

  const exists = await pathExists(paths.file);
  if (exists && !overwrite) {
    const existing = await readExisting(paths.file);
    return NextResponse.json(
      { error: "skill_exists", existing },
      { status: 409 },
    );
  }

  const content = renderSkillFile({ name, description, body });

  try {
    await fs.mkdir(paths.dir, { recursive: true });
    const tmp = paths.file + ".tmp";
    await fs.writeFile(tmp, content, "utf8");
    await fs.rename(tmp, paths.file);
  } catch (err: unknown) {
    const code = typeof err === "object" && err && "code" in err ? String((err as { code?: string }).code) : "unknown";
    return NextResponse.json({ error: "fs_error", code }, { status: 500 });
  }

  const homeRel = paths.file.replace(os.homedir(), "~");
  return NextResponse.json(
    { name, path: homeRel },
    { status: exists ? 200 : 201 },
  );
}

export async function GET() {
  let entries: string[] = [];
  try {
    entries = await fs.readdir(SKILLS_ROOT);
  } catch {
    return NextResponse.json({ skills: [] });
  }
  const skills = [];
  for (const entry of entries) {
    const dir = path.join(SKILLS_ROOT, entry);
    const file = path.join(dir, "SKILL.md");
    try {
      const stat = await fs.stat(file);
      const raw = await fs.readFile(file, "utf8");
      const { data } = matter(raw);
      skills.push({
        name: typeof data.name === "string" ? data.name : entry,
        description: typeof data.description === "string" ? data.description : "",
        modified: stat.mtimeMs,
        size: stat.size,
        dir: entry,
      });
    } catch {
      // skip non-skill entries
    }
  }
  skills.sort((a, b) => b.modified - a.modified);
  return NextResponse.json({ skills });
}
