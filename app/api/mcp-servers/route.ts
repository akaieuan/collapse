import "server-only";
import os from "node:os";
import path from "node:path";
import { promises as fs } from "node:fs";
import { NextResponse } from "next/server";
import { z } from "zod";
import { generateMcpScaffold } from "@/lib/mcp-template";
import type { AnnotationSkillInput } from "@/lib/skill-template";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SERVERS_ROOT = path.join(os.homedir(), ".claude", "mcp-servers");

const AnnotationSkillInputSchema = z.object({
  lessonSlug: z.string().min(1).max(200),
  lessonTitle: z.string().min(1).max(300),
  lang: z.enum(["next", "vue", "nuxt", "qiskit"]),
  shikiLang: z.string().min(1).max(40),
  annotationId: z.string().min(1).max(120),
  kind: z.enum(["note", "core", "gotcha", "mistake", "mnemonic", "cross"]),
  tip: z.string().max(2000),
  remember: z.string().max(2000),
  body: z.string().max(20_000),
  detail: z.string().max(20_000).optional(),
  codeSnippet: z.string().min(1).max(50_000),
});

const PostSchema = z.object({
  name: z
    .string()
    .min(1)
    .max(64)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "kebab-case-only"),
  input: AnnotationSkillInputSchema,
  description: z.string().min(1).max(2048).optional(),
  overwrite: z.boolean().optional(),
});

function localOnly(req: Request): boolean {
  if (process.env.NODE_ENV !== "production") return true;
  const host = req.headers.get("host") ?? "";
  return host.startsWith("localhost") || host.startsWith("127.0.0.1");
}

function safeServerPath(name: string): { dir: string } | null {
  const dir = path.join(SERVERS_ROOT, name);
  const root = SERVERS_ROOT + path.sep;
  if (!dir.startsWith(root)) return null;
  return { dir };
}

async function pathExists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function readExisting(dir: string) {
  try {
    const raw = await fs.readFile(path.join(dir, "package.json"), "utf8");
    const data = JSON.parse(raw) as { name?: unknown; description?: unknown };
    return {
      name: typeof data.name === "string" ? data.name : undefined,
      description: typeof data.description === "string" ? data.description : undefined,
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
  const { name, input, description, overwrite } = parsed.data;
  const paths = safeServerPath(name);
  if (!paths) {
    return NextResponse.json({ error: "invalid_path" }, { status: 400 });
  }

  const exists = await pathExists(paths.dir);
  if (exists && !overwrite) {
    const existing = await readExisting(paths.dir);
    return NextResponse.json({ error: "server_exists", existing }, { status: 409 });
  }

  const scaffold = generateMcpScaffold(input as AnnotationSkillInput, { name, description });

  // Atomic-enough multi-file write: materialise the whole tree in a sibling temp
  // dir, then rename the dir into place. A crash mid-write never leaves a partial
  // server directory behind — only the discardable temp dir.
  const tmpDir = path.join(
    SERVERS_ROOT,
    `.tmp-${name}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
  );
  try {
    await fs.mkdir(SERVERS_ROOT, { recursive: true });
    for (const file of scaffold.files) {
      const dest = path.join(tmpDir, file.path);
      await fs.mkdir(path.dirname(dest), { recursive: true });
      await fs.writeFile(dest, file.content, "utf8");
    }
    if (exists) {
      // overwrite: rename can't clobber a populated dir, so drop the old one first.
      await fs.rm(paths.dir, { recursive: true, force: true });
    }
    await fs.rename(tmpDir, paths.dir);
  } catch (err: unknown) {
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
    const code =
      typeof err === "object" && err && "code" in err
        ? String((err as { code?: string }).code)
        : "unknown";
    return NextResponse.json({ error: "fs_error", code }, { status: 500 });
  }

  const homeRel = paths.dir.replace(os.homedir(), "~");
  return NextResponse.json(
    { name: scaffold.name, toolName: scaffold.toolName, path: homeRel, files: scaffold.files.map((f) => f.path) },
    { status: exists ? 200 : 201 },
  );
}

export async function GET() {
  let entries: string[] = [];
  try {
    entries = await fs.readdir(SERVERS_ROOT);
  } catch {
    return NextResponse.json({ servers: [] });
  }
  const servers = [];
  for (const entry of entries) {
    if (entry.startsWith(".")) continue;
    const dir = path.join(SERVERS_ROOT, entry);
    const pkgFile = path.join(dir, "package.json");
    try {
      const stat = await fs.stat(pkgFile);
      const raw = await fs.readFile(pkgFile, "utf8");
      const data = JSON.parse(raw) as { name?: unknown; description?: unknown };
      servers.push({
        name: typeof data.name === "string" ? data.name : entry,
        description: typeof data.description === "string" ? data.description : "",
        modified: stat.mtimeMs,
        dir: entry,
      });
    } catch {
      // skip non-server entries
    }
  }
  servers.sort((a, b) => b.modified - a.modified);
  return NextResponse.json({ servers });
}
