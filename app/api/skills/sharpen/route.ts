import "server-only";
import { NextResponse } from "next/server";
import { z } from "zod";
import { errorCode, MissingApiKeyError, sharpenDescription } from "@/lib/anthropic";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PostSchema = z.object({
  description: z.string().min(1).max(8000),
  body: z.string().min(1).max(60_000),
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

  try {
    const result = await sharpenDescription(parsed.data);
    return NextResponse.json({ ok: true, ...result });
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
