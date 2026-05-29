import os from "node:os";
import path from "node:path";
import { promises as fs } from "node:fs";
import Link from "next/link";
import { Sparkles } from "lucide-react";
import matter from "gray-matter";
import { lintDraft, qualityVerdict, type QualityVerdict } from "@/lib/skill-quality";
import { QualityDot } from "@/components/forge/quality-badges";
import { SkillRowActions } from "@/components/skills/skill-row-actions";

export const dynamic = "force-dynamic";

const SKILLS_ROOT = path.join(os.homedir(), ".claude", "skills");

type SkillEntry = {
  name: string;
  description: string;
  modified: number;
  size: number;
  dir: string;
  verdict: QualityVerdict;
  warnCount: number;
};

async function loadSkills(): Promise<SkillEntry[]> {
  let entries: string[] = [];
  try {
    entries = await fs.readdir(SKILLS_ROOT);
  } catch {
    return [];
  }
  const out: SkillEntry[] = [];
  for (const entry of entries) {
    const dir = path.join(SKILLS_ROOT, entry);
    const file = path.join(dir, "SKILL.md");
    try {
      const stat = await fs.stat(file);
      const raw = await fs.readFile(file, "utf8");
      const { data, content } = matter(raw);
      const name = typeof data.name === "string" ? data.name : entry;
      const description = typeof data.description === "string" ? data.description : "";
      const issues = lintDraft({ name, description, body: content });
      out.push({
        name,
        description,
        modified: stat.mtimeMs,
        size: stat.size,
        dir: entry,
        verdict: qualityVerdict(issues),
        warnCount: issues.filter((i) => i.severity === "warn").length,
      });
    } catch {
      // skip
    }
  }
  out.sort((a, b) => b.modified - a.modified);
  return out;
}

function formatRelative(ms: number): string {
  const diff = Date.now() - ms;
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return new Date(ms).toLocaleDateString();
}

export default async function SkillsPage() {
  const skills = await loadSkills();
  const warnTotal = skills.filter((s) => s.verdict === "warn").length;
  const infoTotal = skills.filter((s) => s.verdict === "info").length;
  const cleanTotal = skills.filter((s) => s.verdict === "clean").length;

  return (
    <div>
      <div className="border-b border-border/70 bg-card/60">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-4 gap-y-1.5 px-6 py-2.5 font-mono text-[11px] text-muted-foreground">
          <span className="uppercase tracking-[0.14em] text-foreground/80">skills</span>
          <span aria-hidden className="text-muted-foreground/40">·</span>
          <span className="tabular-nums">
            <span className="text-foreground/85">{skills.length}</span> total
          </span>
          <span aria-hidden className="text-muted-foreground/40">·</span>
          <span className="inline-flex items-center gap-1.5 tabular-nums">
            <QualityDot verdict="clean" />
            <span>{cleanTotal}</span>
            <span className="text-muted-foreground/55">clean</span>
          </span>
          <span className="inline-flex items-center gap-1.5 tabular-nums">
            <QualityDot verdict="info" />
            <span>{infoTotal}</span>
            <span className="text-muted-foreground/55">info</span>
          </span>
          <span className="inline-flex items-center gap-1.5 tabular-nums">
            <QualityDot verdict="warn" />
            <span>{warnTotal}</span>
            <span className="text-muted-foreground/55">warn</span>
          </span>
          <code className="ml-auto rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground/90">
            ~/.claude/skills/
          </code>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-6 pb-24 pt-6">
        {skills.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-md border border-border bg-muted/30 p-12 text-center">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-background text-[var(--brand)]">
              <Sparkles className="h-4.5 w-4.5" strokeWidth={1.5} />
            </span>
            <div className="space-y-1">
              <p className="text-[13.5px] font-medium text-foreground">No skills yet</p>
              <p className="text-[12.5px] leading-relaxed text-muted-foreground">
                Open a <Link href="/" className="underline-offset-4 hover:text-foreground hover:underline">concept</Link> and click &quot;Collapse&quot; to forge your first one — or{" "}
                <Link href="/import" className="underline-offset-4 hover:text-foreground hover:underline">import a notebook</Link>.
              </p>
            </div>
          </div>
        ) : (
          <ul className="divide-y divide-border/70 rounded-md border border-border bg-card">
            {skills.map((s) => (
              <li key={s.dir} className="px-4 py-3 transition-colors duration-150 hover:bg-muted/30">
                <div className="flex items-start gap-3">
                  <span className="mt-1.5 shrink-0">
                    <QualityDot verdict={s.verdict} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2">
                      <h2 className="font-mono text-[12.5px] font-medium tracking-tight text-foreground">
                        {s.name}
                      </h2>
                      {s.warnCount > 0 && (
                        <span className="font-mono text-[10px] text-destructive/85">
                          {s.warnCount} warn
                        </span>
                      )}
                    </div>
                    {s.description && (
                      <p className="mt-1 line-clamp-2 text-[12.5px] leading-relaxed text-muted-foreground">
                        {s.description}
                      </p>
                    )}
                    <p className="mt-1 font-mono text-[10.5px] text-muted-foreground/70">
                      ~/.claude/skills/{s.dir}/SKILL.md
                    </p>
                  </div>
                  <div className="shrink-0 text-right font-mono text-[10.5px] text-muted-foreground">
                    <div>{formatRelative(s.modified)}</div>
                    <div className="tabular-nums">{(s.size / 1024).toFixed(1)} KB</div>
                  </div>
                  <SkillRowActions dirName={s.dir} displayName={s.name} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
