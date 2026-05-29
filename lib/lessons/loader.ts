import "server-only";
import path from "node:path";
import { promises as fs } from "node:fs";
import matter from "gray-matter";
import { extractLessonCodes } from "./extract";
import type { Lesson, LessonFrontmatter } from "./types";

const CONTENT_DIR = path.join(process.cwd(), "examples", "concepts");

const cache = new Map<string, Lesson>();

export async function getAllLessonSlugs(): Promise<string[]> {
  const entries = await fs.readdir(CONTENT_DIR);
  return entries
    .filter((f) => f.endsWith(".mdx"))
    .map((f) => f.replace(/\.mdx$/, ""))
    .sort();
}

export async function getLesson(slug: string): Promise<Lesson | null> {
  if (cache.has(slug) && process.env.NODE_ENV === "production") {
    return cache.get(slug) ?? null;
  }
  const filePath = path.join(CONTENT_DIR, `${slug}.mdx`);
  let raw: string;
  try {
    raw = await fs.readFile(filePath, "utf8");
  } catch {
    return null;
  }
  const { data, content } = matter(raw);
  const fm = normalizeFrontmatter(slug, data);
  const codes = extractLessonCodes(content);
  const lesson: Lesson = { frontmatter: fm, source: content, codes };
  cache.set(slug, lesson);
  return lesson;
}

export async function getAllLessons(): Promise<Lesson[]> {
  const slugs = await getAllLessonSlugs();
  const lessons = await Promise.all(slugs.map((s) => getLesson(s)));
  return lessons.filter((l): l is Lesson => l !== null);
}

function normalizeFrontmatter(
  slug: string,
  data: Record<string, unknown>,
): LessonFrontmatter {
  const langs = Array.isArray(data.languages) ? data.languages : [];
  return {
    slug,
    title: typeof data.title === "string" ? data.title : slug,
    summary: typeof data.summary === "string" ? data.summary : "",
    category: typeof data.category === "string" ? data.category : "Foundations",
    languages: langs.filter((l) =>
      ["next", "vue", "nuxt", "qiskit"].includes(l as string),
    ) as LessonFrontmatter["languages"],
    primary: data.primary as LessonFrontmatter["primary"],
    qiskitNote: typeof data.qiskitNote === "string" ? data.qiskitNote : undefined,
  };
}
