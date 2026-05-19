import "server-only";
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  applySkill,
  errorCode,
  evaluateTrigger,
  MissingApiKeyError,
} from "@/lib/anthropic";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PostSchema = z.object({
  description: z.string().min(1).max(8000),
  body: z.string().min(1).max(60_000),
  userPrompt: z.string().min(1).max(4000),
  mode: z.enum(["trigger", "apply"]),
});

function localOnly(req: Request): boolean {
  if (process.env.NODE_ENV !== "production") return true;
  const host = req.headers.get("host") ?? "";
  return host.startsWith("localhost") || host.startsWith("127.0.0.1");
}

export async function POST(req: Request) {
  if (!localOnly(req)) {
    return NextResponse.json({ ok: false, error: "remote_blocked" }, { status: 403 });
  }
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const parsed = PostSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "invalid_request", issues: parsed.error.issues },
      { status: 400 },
    );
  }
  const { description, body, userPrompt, mode } = parsed.data;

  try {
    if (mode === "trigger") {
      const result = await evaluateTrigger({ description, userPrompt });
      return NextResponse.json({ ok: true, mode, ...result });
    } else {
      const result = await applySkill({ body, userPrompt });
      return NextResponse.json({ ok: true, mode, ...result });
    }
  } catch (err) {
    const code = errorCode(err);
    const status = err instanceof MissingApiKeyError ? 503 : 500;
    return NextResponse.json(
      {
        ok: false,
        error: code,
        message: err instanceof Error ? err.message : String(err),
      },
      { status },
    );
  }
}
