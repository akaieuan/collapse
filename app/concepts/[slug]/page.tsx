import { notFound } from "next/navigation";
import Link from "next/link";
import { MDXRemote } from "next-mdx-remote-client/rsc";
import rehypeShiki from "@shikijs/rehype";
import remarkGfm from "remark-gfm";
import { LessonProvider } from "@/components/lesson-provider";
import { LangTabsBar } from "@/components/lang-tabs-bar";
import { AnnotationPanel } from "@/components/annotation-panel";
import { AnnotationTooltip } from "@/components/annotation-tooltip";
import { SkillExportButton } from "@/components/skill-export-button";
import { mdxComponents } from "@/components/mdx/components";
import { annotationTransformer } from "@/lib/shiki/annotation-transformer";
import { getAllLessonSlugs, getLesson } from "@/lib/lessons/loader";
import { type LangKey } from "@/lib/lessons/types";
import { THEMES } from "@/lib/shiki/highlighter";

export const dynamic = "force-static";

export async function generateStaticParams() {
  const slugs = await getAllLessonSlugs();
  return slugs.map((slug) => ({ slug }));
}

export default async function ConceptPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const lesson = await getLesson(slug);
  if (!lesson) notFound();

  const initialLang: LangKey =
    lesson.frontmatter.primary ?? lesson.frontmatter.languages[0] ?? "next";
  const langs = lesson.frontmatter.languages;
  const kindMap = new Map<string, string>();
  let totalNotes = 0;
  for (const code of lesson.codes) {
    for (const a of code.annotations) {
      kindMap.set(a.id, a.kind);
      totalNotes += 1;
    }
  }

  return (
    <LessonProvider lesson={lesson} initialLang={initialLang}>
      {/* Toolbar — replaces the marketing header */}
      <div className="border-b border-border/70 bg-card/60">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-4 gap-y-2 px-6 py-2.5 font-mono text-[11px]">
          <div className="flex min-w-0 items-center gap-1.5 text-muted-foreground">
            <Link
              href="/"
              className="uppercase tracking-[0.14em] hover:text-foreground"
            >
              concepts
            </Link>
            <span aria-hidden className="text-muted-foreground/50">/</span>
            <span className="uppercase tracking-[0.14em] text-muted-foreground/80">
              {lesson.frontmatter.category}
            </span>
            <span aria-hidden className="text-muted-foreground/50">/</span>
            <span className="truncate text-foreground">{lesson.frontmatter.title}</span>
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-x-3 gap-y-1.5 text-muted-foreground">
            <span className="tabular-nums">
              <span className="text-foreground/80">{totalNotes}</span> notes
            </span>
            <span aria-hidden className="text-muted-foreground/40">·</span>
            <span className="tabular-nums">
              <span className="text-foreground/80">{langs.length}</span> stacks
            </span>
            <span aria-hidden className="text-muted-foreground/40">·</span>
            <code className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground/90">
              content/concepts/{slug}.mdx
            </code>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-6 pb-24 pt-4">
        {/* Compact action row */}
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <SkillExportButton slug={lesson.frontmatter.slug} />
          <Link
            href={`/concepts/${slug}/grid`}
            className="inline-flex h-8 items-center rounded-md border border-border bg-background px-3 font-mono text-[11px] uppercase tracking-[0.08em] text-foreground/80 transition-colors hover:border-foreground/30 hover:bg-muted hover:text-foreground"
          >
            Side-by-side
            <span aria-hidden className="ml-1.5 text-muted-foreground">↗</span>
          </Link>
        </div>

        {lesson.frontmatter.summary && (
          <p className="mb-4 text-[13px] leading-relaxed text-muted-foreground">
            {lesson.frontmatter.summary}
          </p>
        )}

        <LangTabsBar />

        <article className="lesson-content moth-tabs-mode">
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
