import { ImportFlow } from "./import-flow";

export const metadata = {
  title: "Import notebook · Collapse",
  description: "Collapse a Jupyter notebook or MyST chapter into a Claude skill.",
};

export default function ImportPage() {
  return (
    <main className="min-h-svh">
      <div className="mx-auto w-full max-w-6xl px-6 py-10">
        <header className="mb-8 space-y-2">
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
            Collapse / import
          </p>
          <h1 className="text-3xl font-semibold tracking-tight">Notebook → skill</h1>
          <p className="max-w-2xl text-[13px] leading-relaxed text-muted-foreground">
            Drop in a Jupyter notebook
            (<code className="rounded bg-muted px-1 py-0.5 font-mono text-[12px]">.ipynb</code>)
            or a MyST chapter
            (<code className="rounded bg-muted px-1 py-0.5 font-mono text-[12px]">.md</code>).
            Pick the code cell that holds the pattern, annotate it, collapse it into a Claude skill.
            MyST admonitions in nearby markdown cells become draft annotations automatically.
          </p>
        </header>
        <ImportFlow />
      </div>
    </main>
  );
}
