import { ReviewSession } from "@/components/study/review-session";
import { getAllLessons } from "@/lib/lessons/loader";
import { snippetForAnnotation } from "@/lib/lessons/snippet";

export const metadata = {
  title: "Review — Quantopera",
  description: "Active recall queue. Predict each annotation, then grade yourself.",
};

export const dynamic = "force-dynamic";

export default async function ReviewPage() {
  const lessons = await getAllLessons();
  const flat = lessons.flatMap((l) =>
    l.codes.flatMap((c) =>
      c.annotations.map((a) => ({
        key: `${l.frontmatter.slug}#${a.id}`,
        slug: l.frontmatter.slug,
        annotId: a.id,
        title: l.frontmatter.title,
        kind: a.kind,
        tip: a.tip,
        remember: a.remember,
        body: a.body,
        codeSnippet: snippetForAnnotation(c.code, c.meta, a.id),
        codeLang: c.shikiLang,
      })),
    ),
  );

  return (
    <div className="mx-auto max-w-3xl px-6 pb-24 pt-12">
      <div className="mb-6">
        <h1 className="text-3xl font-semibold tracking-tight">Review</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          For each annotation due today: read the code, predict the answer, then grade yourself.
        </p>
      </div>
      <ReviewSession allAnnotations={flat} />
    </div>
  );
}

