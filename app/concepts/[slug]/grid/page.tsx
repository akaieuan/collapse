import { notFound } from "next/navigation";
import Link from "next/link";
import { MDXRemote } from "next-mdx-remote-client/rsc";
import rehypeShiki from "@shikijs/rehype";
import remarkGfm from "remark-gfm";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { LessonProvider } from "@/components/lesson-provider";
import { AnnotationPanel } from "@/components/annotation-panel";
import { AnnotationTooltip } from "@/components/annotation-tooltip";
import { mdxComponents } from "@/components/mdx/components";
import { annotationTransformer } from "@/lib/shiki/annotation-transformer";
import { getAllLessonSlugs, getLesson } from "@/lib/lessons/loader";
import { LANG_LABELS, type LangKey } from "@/lib/lessons/types";
import { THEMES } from "@/lib/shiki/highlighter";

export const dynamic = "force-static";

export async function generateStaticParams() {
  const slugs = await getAllLessonSlugs();
  return slugs.map((slug) => ({ slug }));
}

export default async function GridPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const lesson = await getLesson(slug);
  if (!lesson) notFound();

  const initialLang: LangKey = lesson.frontmatter.primary ?? lesson.frontmatter.languages[0] ?? "next";
  const kindMap = new Map<string, string>();
  for (const code of lesson.codes) {
    for (const a of code.annotations) kindMap.set(a.id, a.kind);
  }

  return (
    <LessonProvider lesson={lesson} initialLang={initialLang}>
      <div className="mx-auto max-w-6xl px-6 pb-24 pt-10">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
              {lesson.frontmatter.category}
            </p>
            <h1 className="text-2xl font-light tracking-tight md:text-3xl">
              {lesson.frontmatter.title} <span className="text-muted-foreground">— side-by-side</span>
            </h1>
            {lesson.frontmatter.summary && (
              <p className="mt-2 max-w-2xl text-muted-foreground">{lesson.frontmatter.summary}</p>
            )}
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              {lesson.frontmatter.languages.map((l) => (
                <Badge key={l} variant="outline" className="text-[11px] font-normal">
                  {LANG_LABELS[l]}
                </Badge>
              ))}
            </div>
          </div>
          <Link
            href={`/concepts/${slug}`}
            className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
          >
            ← Back to tabs view
          </Link>
        </div>

        <Separator className="mb-6" />

        <article className="lesson-content moth-grid-mode grid gap-6 md:grid-cols-2">
          <MDXRemote
            source={lesson.source}
            components={mdxComponents}
            options={{
              parseFrontmatter: false,
              mdxOptions: {
                remarkPlugins: [remarkGfm],
                rehypePlugins: [
                  [
                    rehypeShiki,
                    {
                      themes: { light: THEMES.light, dark: THEMES.dark },
                      transformers: [annotationTransformer({ kindMap })],
                    },
                  ],
                ],
              },
            }}
          />
        </article>
        <AnnotationPanel />
      </div>
      <AnnotationTooltip />
    </LessonProvider>
  );
}
