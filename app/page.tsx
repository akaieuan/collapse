import Link from "next/link";
import { BookOpen } from "lucide-react";
import { getAllLessons } from "@/lib/lessons/loader";
import { LANG_LABELS } from "@/lib/lessons/types";

export const dynamic = "force-static";

export default async function Home() {
  const lessons = await getAllLessons();
  const byCategory = new Map<string, typeof lessons>();
  for (const lesson of lessons) {
    const arr = byCategory.get(lesson.frontmatter.category) ?? [];
    arr.push(lesson);
    byCategory.set(lesson.frontmatter.category, arr);
  }

  const totalNotes = lessons.reduce(
    (acc, l) => acc + l.codes.reduce((a, c) => a + c.annotations.length, 0),
    0,
  );

  return (
    <div>
      {/* Stats strip — internal-tool index header */}
      <div className="border-b border-border/70 bg-card/60">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-1.5 px-6 py-2.5 font-mono text-[11px] text-muted-foreground">
          <span className="uppercase tracking-[0.14em] text-foreground/80">index</span>
          <span aria-hidden className="text-muted-foreground/40">·</span>
          <span className="tabular-nums">
            <span className="text-foreground/85">{lessons.length}</span> concepts
          </span>
          <span aria-hidden className="text-muted-foreground/40">·</span>
          <span className="tabular-nums">
            <span className="text-foreground/85">{totalNotes}</span> notes
          </span>
          <span aria-hidden className="text-muted-foreground/40">·</span>
          <span className="tabular-nums">
            <span className="text-foreground/85">{byCategory.size}</span> categories
          </span>
          <div className="ml-auto flex items-center gap-2">
            <Link href="/skills" className="hover:text-foreground">
              skills →
            </Link>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-6 pb-24 pt-6">
        {[...byCategory.entries()].map(([category, items]) => (
          <section key={category} className="mb-10">
            <div className="mb-3 flex items-baseline justify-between border-b border-border/60 pb-2">
              <h2 className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-foreground/75">
                {category}
              </h2>
              <span className="font-mono text-[10.5px] tabular-nums text-muted-foreground">
                {String(items.length).padStart(2, "0")}
              </span>
            </div>
            <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
              {items.map((lesson) => (
                <ConceptCard
                  key={lesson.frontmatter.slug}
                  slug={lesson.frontmatter.slug}
                  title={lesson.frontmatter.title}
                  summary={lesson.frontmatter.summary}
                  languages={lesson.frontmatter.languages}
                  noteCount={lesson.codes.reduce((a, c) => a + c.annotations.length, 0)}
                />
              ))}
            </div>
          </section>
        ))}

        {lessons.length === 0 && (
          <div className="flex flex-col items-center gap-3 rounded-md border border-border bg-muted/30 p-12 text-center">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-background text-muted-foreground">
              <BookOpen className="h-4.5 w-4.5" strokeWidth={1.5} />
            </span>
            <div className="space-y-1">
              <p className="text-[13.5px] font-medium text-foreground">No concepts yet</p>
              <p className="text-[12.5px] leading-relaxed text-muted-foreground">
                Drop an MDX file into <code className="rounded bg-background px-1 py-0.5 font-mono text-[11px]">examples/concepts/</code> to start authoring.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ConceptCard({
  slug,
  title,
  summary,
  languages,
  noteCount,
}: {
  slug: string;
  title: string;
  summary?: string;
  languages: readonly (keyof typeof LANG_LABELS)[];
  noteCount: number;
}) {
  return (
    <Link
      href={`/concepts/${slug}`}
      className="group relative flex h-full flex-col gap-2 overflow-hidden rounded-2xl border border-border/40 bg-card/40 p-4 transition-all duration-200 hover:-translate-y-0.5 hover:bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] focus-visible:ring-offset-1 focus-visible:ring-offset-background"
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-[14px] font-medium leading-snug tracking-tight text-foreground">
          {title}
        </h3>
        <span
          aria-hidden
          className="shrink-0 font-mono text-[10.5px] tabular-nums text-muted-foreground/70"
        >
          {String(noteCount).padStart(2, "0")}
        </span>
      </div>

      {summary && (
        <p className="line-clamp-2 text-[12.5px] leading-relaxed text-muted-foreground">
          {summary}
        </p>
      )}

      <div className="mt-auto flex flex-wrap items-center gap-1 pt-1.5">
        {languages.map((l) => (
          <span
            key={l}
            className="inline-flex h-4 items-center rounded border border-border/70 bg-background px-1.5 font-mono text-[9.5px] uppercase tracking-wide text-muted-foreground transition-colors group-hover:border-foreground/20 group-hover:text-foreground/80"
          >
            {LANG_LABELS[l]}
          </span>
        ))}
      </div>
    </Link>
  );
}
