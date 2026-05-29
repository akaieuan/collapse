"use client";

import { useMemo, useState } from "react";
import { motion } from "motion/react";
import { toast } from "sonner";
import { parseIpynb, IpynbParseError } from "@/lib/notebook/parse-ipynb";
import { parseMyst } from "@/lib/notebook/parse-myst";
import {
  admonitionToAnnotationKind,
  toAnnotationSkillInput,
} from "@/lib/notebook/to-annotation-input";
import {
  generateAnnotationSkillDraft,
  type SkillDraft,
} from "@/lib/skill-template";
import type {
  ParsedCell,
  ParsedNotebook,
} from "@/lib/notebook/types";
import type { AnnotationKind, LangKey } from "@/lib/lessons/types";
import {
  ALL_LANGS,
  ANNOTATION_KIND_LABEL,
  LANG_LABELS,
} from "@/lib/lessons/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";

type SourceType = "ipynb" | "myst";

type AnnotationDraft = {
  id: string;
  kind: AnnotationKind;
  tip: string;
  remember: string;
  body: string;
  detail: string;
};

const KIND_OPTIONS: AnnotationKind[] = [
  "core",
  "note",
  "gotcha",
  "mistake",
  "mnemonic",
  "cross",
];

const EMPTY_ANNOTATION: AnnotationDraft = {
  id: "",
  kind: "core",
  tip: "",
  remember: "",
  body: "",
  detail: "",
};

const STAGE_MOTION = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.2, ease: [0.2, 0.65, 0.3, 0.9] as const },
};

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

function detectSourceType(raw: string): SourceType {
  const head = raw.trimStart().slice(0, 1);
  return head === "{" ? "ipynb" : "myst";
}

function defaultLangForNotebook(lang: string): LangKey {
  const l = lang.toLowerCase();
  if (l.includes("python") || l === "py") return "qiskit";
  if (l === "typescript" || l === "tsx" || l === "ts") return "next";
  return "qiskit";
}

export function ImportFlow() {
  const [raw, setRaw] = useState("");
  const [sourceType, setSourceType] = useState<SourceType>("ipynb");
  const [parsed, setParsed] = useState<ParsedNotebook | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [notebookSlug, setNotebookSlug] = useState("");
  const [notebookTitle, setNotebookTitle] = useState("");
  const [lang, setLang] = useState<LangKey>("qiskit");
  const [annotation, setAnnotation] = useState<AnnotationDraft>(EMPTY_ANNOTATION);
  const [draft, setDraft] = useState<SkillDraft | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [collision, setCollision] = useState<{ existingDescription?: string } | null>(null);

  const selectedCell: ParsedCell | null = useMemo(() => {
    if (parsed === null || selectedIdx === null) return null;
    return parsed.cells[selectedIdx] ?? null;
  }, [parsed, selectedIdx]);

  function resetAll() {
    setRaw("");
    setParsed(null);
    setParseError(null);
    setSelectedIdx(null);
    setNotebookSlug("");
    setNotebookTitle("");
    setLang("qiskit");
    setAnnotation(EMPTY_ANNOTATION);
    setDraft(null);
    setCollision(null);
  }

  function handleFile(file: File) {
    file
      .text()
      .then((text) => {
        setRaw(text);
        setSourceType(file.name.endsWith(".ipynb") ? "ipynb" : detectSourceType(text));
      })
      .catch(() => toast.error("Failed to read file"));
  }

  async function loadSample() {
    try {
      const res = await fetch("/api/examples/notebook");
      if (!res.ok) {
        toast.error("Failed to load sample notebook");
        return;
      }
      const text = await res.text();
      setRaw(text);
      setSourceType("ipynb");
      toast.success("Loaded sample notebook — hit Parse");
    } catch {
      toast.error("Failed to load sample notebook");
    }
  }

  function handleParse() {
    setParseError(null);
    setDraft(null);
    setCollision(null);
    if (!raw.trim()) {
      setParseError("Paste a notebook or chapter first.");
      return;
    }
    const inferred = sourceType ?? detectSourceType(raw);
    try {
      const result = inferred === "ipynb" ? parseIpynb(raw) : parseMyst(raw);
      setParsed(result);
      setSelectedIdx(null);
      setLang(defaultLangForNotebook(result.language));
      if (result.title) {
        setNotebookTitle(result.title);
        if (!notebookSlug) setNotebookSlug(slugify(result.title));
      }
    } catch (err) {
      const message =
        err instanceof IpynbParseError || err instanceof Error
          ? err.message
          : "Could not parse the input";
      setParseError(message);
      setParsed(null);
    }
  }

  function handleSelectCell(idx: number) {
    if (parsed === null) return;
    const cell = parsed.cells[idx];
    if (!cell || cell.type !== "code") return;
    setSelectedIdx(idx);
    setDraft(null);
    setCollision(null);

    let prefill: Partial<AnnotationDraft> | null = null;
    for (let i = idx - 1; i >= 0; i--) {
      const prev = parsed.cells[i];
      if (prev.type === "code") break;
      if (prev.type === "markdown" && prev.admonitions.length > 0) {
        const a = prev.admonitions[0];
        prefill = {
          kind: admonitionToAnnotationKind(a.kind),
          tip: a.title ?? "",
          body: a.body,
        };
        break;
      }
    }

    if (prefill) {
      setAnnotation((prev) => ({
        ...prev,
        ...prefill,
        id: prev.id || slugify(prefill.tip ?? "") || `cell-${idx + 1}`,
      }));
      toast.success("Pre-filled from a MyST admonition in the preceding prose.");
    } else {
      setAnnotation((prev) => ({
        ...prev,
        id: prev.id || `cell-${idx + 1}`,
      }));
    }
  }

  function handleGenerateDraft() {
    if (selectedCell === null || selectedCell.type !== "code") return;
    if (!annotation.id.trim()) {
      toast.error("Annotation id is required (kebab-case).");
      return;
    }
    if (!annotation.tip.trim() && !annotation.body.trim()) {
      toast.error("Add at least a tip or a body before generating.");
      return;
    }
    const input = toAnnotationSkillInput({
      cellSource: selectedCell.source,
      lang,
      notebookSlug: notebookSlug || "imported-notebook",
      notebookTitle: notebookTitle || "Imported notebook",
      annotation: {
        id: annotation.id.trim(),
        kind: annotation.kind,
        tip: annotation.tip.trim(),
        remember: annotation.remember.trim(),
        body: annotation.body.trim(),
        detail: annotation.detail.trim() || undefined,
      },
    });
    const generated = generateAnnotationSkillDraft(input);
    setDraft(generated);
    setCollision(null);
  }

  async function submitDraft(overwrite: boolean) {
    if (!draft) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/skills", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...draft, overwrite }),
      });
      const data = await res.json();
      if (res.status === 409) {
        setCollision({ existingDescription: data?.existing?.description });
        return;
      }
      if (!res.ok) {
        toast.error(data?.error ?? "Failed to write skill");
        return;
      }
      toast.success(`Collapsed → ${data.path}`);
      setCollision(null);
    } finally {
      setSubmitting(false);
    }
  }

  const skillPath = draft ? `~/.claude/skills/${draft.name}/SKILL.md` : "";
  const draftPreview = useMemo(() => {
    if (!draft) return "";
    return `---\nname: ${draft.name}\ndescription: ${draft.description.replace(/\s+/g, " ").trim()}\n---\n\n${draft.body.trimEnd()}\n`;
  }, [draft]);

  return (
    <div className="grid gap-6">
      {/* === Stage 1: input ============================================ */}
      <motion.div {...STAGE_MOTION}>
        <Card className="gap-0 overflow-hidden p-0">
          <div className="flex items-center justify-between gap-4 border-b border-border/60 px-5 py-3">
            <div className="space-y-0.5">
              <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                1 · Source
              </p>
              <p className="text-[13px] text-foreground">
                Paste raw content or upload a file.
              </p>
            </div>
            <SegmentedToggle
              value={sourceType}
              onChange={setSourceType}
              options={[
                { value: "ipynb", label: ".ipynb" },
                { value: "myst", label: ".md (MyST)" },
              ]}
            />
          </div>
          <div className="grid gap-3 px-5 py-4">
            <Textarea
              value={raw}
              onChange={(e) => setRaw(e.target.value)}
              placeholder={
                sourceType === "ipynb"
                  ? '{"cells": [{"cell_type": "code", "source": "qc = QuantumCircuit(3, 3)\\n", ...}], ...}'
                  : "# Quantum teleportation\n\n```{code-cell} python\nqc = QuantumCircuit(3, 3)\n```"
              }
              rows={10}
              className="field-sizing-fixed resize-none font-mono text-[12px] leading-relaxed"
            />
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <label className="inline-flex cursor-pointer items-center gap-2 text-[12px] text-muted-foreground hover:text-foreground">
                  <input
                    type="file"
                    accept=".ipynb,.md,.json"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleFile(file);
                    }}
                    className="hidden"
                  />
                  <span className="rounded-md border border-border/60 px-2 py-1 font-mono text-[11px]">
                    Upload file
                  </span>
                </label>
                <button
                  type="button"
                  onClick={loadSample}
                  className="rounded-md border border-border/60 px-2 py-1 font-mono text-[11px] text-muted-foreground transition-colors hover:border-border hover:text-foreground"
                >
                  Try sample
                </button>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="ghost" onClick={resetAll} size="sm">
                  Reset
                </Button>
                <Button onClick={handleParse} size="sm">
                  Parse
                </Button>
              </div>
            </div>
            {parseError ? (
              <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-[12.5px] text-destructive">
                {parseError}
              </p>
            ) : null}
          </div>
        </Card>
      </motion.div>

      {/* === Stage 2: annotate ========================================= */}
      {parsed ? (
        <motion.div {...STAGE_MOTION}>
          <Card className="gap-0 overflow-hidden p-0">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 px-5 py-3">
              <div className="space-y-0.5">
                <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                  2 · Pick a cell, annotate it
                </p>
                <p className="text-[13px] text-foreground">
                  {parsed.cells.length} cell{parsed.cells.length === 1 ? "" : "s"} ·{" "}
                  <span className="text-muted-foreground">{parsed.source}</span> ·{" "}
                  <span className="font-mono text-muted-foreground">{parsed.language}</span>
                </p>
              </div>
              <div className="grid gap-1.5 sm:flex sm:items-end sm:gap-3">
                <FieldInline
                  label="Notebook slug"
                  value={notebookSlug}
                  onChange={setNotebookSlug}
                  placeholder="quantum-teleportation"
                  width="w-48"
                />
                <FieldInline
                  label="Notebook title"
                  value={notebookTitle}
                  onChange={setNotebookTitle}
                  placeholder="Quantum teleportation"
                  width="w-60"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
              <div className="max-h-[520px] overflow-auto border-b border-border/60 md:border-b-0 md:border-r">
                <ol className="divide-y divide-border/60">
                  {parsed.cells.map((cell, idx) => (
                    <CellRow
                      key={idx}
                      cell={cell}
                      index={idx}
                      selected={selectedIdx === idx}
                      onSelect={() => handleSelectCell(idx)}
                    />
                  ))}
                </ol>
              </div>

              <div className="space-y-4 px-5 py-4">
                {selectedCell && selectedCell.type === "code" ? (
                  <>
                    <div className="space-y-1.5">
                      <p className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-muted-foreground">
                        Selected cell ({selectedCell.language ?? parsed.language})
                      </p>
                      <pre className="max-h-48 overflow-auto rounded-md border bg-muted/40 p-3 font-mono text-[12px] leading-relaxed">
                        {selectedCell.source.trimEnd()}
                      </pre>
                    </div>

                    <div className="flex flex-wrap items-end gap-3">
                      <FieldStack
                        label="Annotation id"
                        width="w-48"
                        value={annotation.id}
                        onChange={(v) => setAnnotation({ ...annotation, id: v })}
                        placeholder="encode-step"
                      />
                      <LangChoice value={lang} onChange={setLang} />
                    </div>

                    <KindChoice
                      value={annotation.kind}
                      onChange={(k) => setAnnotation({ ...annotation, kind: k })}
                    />

                    <FieldStack
                      label="Tip (one-line)"
                      value={annotation.tip}
                      onChange={(v) => setAnnotation({ ...annotation, tip: v })}
                      placeholder="encode() returns a fresh QuantumCircuit each call"
                    />
                    <FieldStack
                      label="Remember (mnemonic, optional)"
                      value={annotation.remember}
                      onChange={(v) => setAnnotation({ ...annotation, remember: v })}
                      placeholder="Encode is pure: in → audio, out → circuit"
                    />
                    <FieldStack
                      label="Body"
                      multiline
                      value={annotation.body}
                      onChange={(v) => setAnnotation({ ...annotation, body: v })}
                      placeholder="Why this pattern works in plain language…"
                    />
                    <FieldStack
                      label="Deeper notes (optional)"
                      multiline
                      value={annotation.detail}
                      onChange={(v) => setAnnotation({ ...annotation, detail: v })}
                      placeholder="Edge cases, gotchas, scaling behavior…"
                    />

                    <div className="flex justify-end gap-2 pt-1">
                      <Button onClick={handleGenerateDraft} size="sm">
                        Generate skill draft
                      </Button>
                    </div>
                  </>
                ) : (
                  <p className="py-12 text-center text-sm text-muted-foreground">
                    Pick a code cell on the left to annotate.
                  </p>
                )}
              </div>
            </div>
          </Card>
        </motion.div>
      ) : null}

      {/* === Stage 3: draft + submit =================================== */}
      {draft ? (
        <motion.div {...STAGE_MOTION}>
          <Card className="gap-0 overflow-hidden p-0">
            <div className="flex items-center justify-between gap-4 border-b border-border/60 px-5 py-3">
              <div className="space-y-0.5">
                <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                  3 · Collapse to skill
                </p>
                <p className="font-mono text-[11px] text-muted-foreground">{skillPath}</p>
              </div>
              <Badge variant="secondary" className="font-mono text-[11px]">/{draft.name}</Badge>
            </div>

            <div className="grid gap-4 px-5 py-4">
              <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
                <FieldStack
                  label="Name"
                  value={draft.name}
                  onChange={(v) => setDraft({ ...draft, name: v })}
                  placeholder="kebab-case-name"
                  mono
                />
                <FieldStack
                  label="Trigger description"
                  multiline
                  value={draft.description}
                  onChange={(v) => setDraft({ ...draft, description: v })}
                />
              </div>

              <div className="space-y-1.5">
                <Label className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-muted-foreground">
                  Body
                </Label>
                <Tabs defaultValue="edit">
                  <TabsList className="h-8 bg-muted/40">
                    <TabsTrigger value="edit" className="text-[12px]">
                      Edit
                    </TabsTrigger>
                    <TabsTrigger value="preview" className="text-[12px]">
                      Preview
                    </TabsTrigger>
                  </TabsList>
                  <TabsContent value="edit" className="mt-2">
                    <Textarea
                      value={draft.body}
                      onChange={(e) => setDraft({ ...draft, body: e.target.value })}
                      className="field-sizing-fixed h-[300px] resize-none font-mono text-[12px] leading-relaxed"
                    />
                  </TabsContent>
                  <TabsContent value="preview" className="mt-2">
                    <pre className="h-[300px] overflow-auto whitespace-pre-wrap break-words rounded-md border bg-muted/30 p-4 font-mono text-[12px] leading-relaxed">
                      {draftPreview}
                    </pre>
                  </TabsContent>
                </Tabs>
              </div>

              {collision ? (
                <div className="rounded-md border border-border bg-muted/40 p-3 text-sm">
                  <p className="font-medium">
                    A skill named &quot;{draft.name}&quot; already exists.
                  </p>
                  {collision.existingDescription ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Current: {collision.existingDescription.slice(0, 140)}…
                    </p>
                  ) : null}
                  <div className="mt-3 flex gap-2">
                    <Button size="sm" onClick={() => submitDraft(true)} disabled={submitting}>
                      Overwrite
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setCollision(null)}
                    >
                      Rename
                    </Button>
                  </div>
                </div>
              ) : null}

              <Separator />

              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setDraft(null)} disabled={submitting}>
                  Back
                </Button>
                <Button onClick={() => submitDraft(false)} disabled={submitting}>
                  {submitting ? "Collapsing…" : "Collapse"}
                </Button>
              </div>
            </div>
          </Card>
        </motion.div>
      ) : null}
    </div>
  );
}

// ----- small helpers -------------------------------------------------------

function CellRow({
  cell,
  index,
  selected,
  onSelect,
}: {
  cell: ParsedCell;
  index: number;
  selected: boolean;
  onSelect: () => void;
}) {
  const isCode = cell.type === "code";
  const firstLine =
    cell.source
      .split("\n")
      .map((s) => s.trim())
      .find((s) => s.length > 0) ?? "";
  const lines = cell.source.split("\n").length;

  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        disabled={!isCode}
        className={`w-full px-4 py-3 text-left text-[12.5px] transition-colors ${
          selected
            ? "bg-[var(--brand)]/10"
            : isCode
              ? "hover:bg-muted/60"
              : "cursor-default opacity-80"
        }`}
      >
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10.5px] text-muted-foreground">
            {String(index + 1).padStart(2, "0")}
          </span>
          <Badge
            variant={isCode ? "default" : "outline"}
            className="font-mono text-[10px] uppercase tracking-wider"
          >
            {isCode ? "code" : "md"}
          </Badge>
          {cell.admonitions.length > 0 ? (
            <Badge variant="secondary" className="font-mono text-[10px] uppercase tracking-wider">
              {cell.admonitions.length} admon.
            </Badge>
          ) : null}
          <span className="ml-auto font-mono text-[10.5px] text-muted-foreground">
            {lines} ln
          </span>
        </div>
        <p
          className={`mt-1.5 line-clamp-2 ${
            isCode ? "font-mono text-[12px] text-foreground/90" : "text-muted-foreground"
          }`}
        >
          {firstLine || "(empty)"}
        </p>
      </button>
    </li>
  );
}

function SegmentedToggle<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div className="inline-flex rounded-md border border-border/60 bg-muted/30 p-0.5">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`rounded-[5px] px-3 py-1 font-mono text-[11px] uppercase tracking-[0.08em] transition-colors ${
            opt.value === value
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function LangChoice({
  value,
  onChange,
}: {
  value: LangKey;
  onChange: (v: LangKey) => void;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <Label className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-muted-foreground">
        Target language
      </Label>
      <div className="inline-flex rounded-md border border-border/60 bg-muted/30 p-0.5">
        {ALL_LANGS.map((l) => (
          <button
            key={l}
            type="button"
            onClick={() => onChange(l)}
            className={`rounded-[5px] px-2.5 py-1 font-mono text-[11px] transition-colors ${
              l === value
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {LANG_LABELS[l]}
          </button>
        ))}
      </div>
    </div>
  );
}

function KindChoice({
  value,
  onChange,
}: {
  value: AnnotationKind;
  onChange: (v: AnnotationKind) => void;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <Label className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-muted-foreground">
        Annotation kind
      </Label>
      <div className="flex flex-wrap gap-1.5">
        {KIND_OPTIONS.map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => onChange(k)}
            className={`rounded-md border px-2.5 py-1 text-[12px] transition-colors ${
              k === value
                ? "border-foreground bg-foreground text-background"
                : "border-border/60 text-muted-foreground hover:border-border hover:text-foreground"
            }`}
          >
            {ANNOTATION_KIND_LABEL[k]}
          </button>
        ))}
      </div>
    </div>
  );
}

function FieldStack({
  label,
  value,
  onChange,
  placeholder,
  multiline,
  width,
  mono,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
  width?: string;
  mono?: boolean;
}) {
  return (
    <div className={`flex min-w-0 flex-col gap-1.5 ${width ?? "w-full"}`}>
      <Label className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </Label>
      {multiline ? (
        <Textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={3}
          className={`field-sizing-fixed resize-none text-[13px] leading-relaxed ${mono ? "font-mono" : ""}`}
        />
      ) : (
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={`text-[13px] ${mono ? "font-mono" : ""}`}
        />
      )}
    </div>
  );
}

function FieldInline({
  label,
  value,
  onChange,
  placeholder,
  width,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  width?: string;
}) {
  return (
    <div className={`flex min-w-0 flex-col gap-1 ${width ?? "w-full"}`}>
      <Label className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </Label>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-8 font-mono text-[12px]"
      />
    </div>
  );
}
