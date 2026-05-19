import "server-only";
import { NextResponse } from "next/server";
import { getLesson } from "@/lib/lessons/loader";
import { generateSkillDraft } from "@/lib/skill-template";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const slug = url.searchParams.get("slug");
  if (!slug) {
    return NextResponse.json({ error: "missing_slug" }, { status: 400 });
  }
  const lesson = await getLesson(slug);
  if (!lesson) {
    return NextResponse.json({ error: "lesson_not_found" }, { status: 404 });
  }
  const draft = generateSkillDraft(lesson);
  return NextResponse.json(draft);
}
