import { describe, expect, it } from "vitest";
import { extractAdmonitions } from "./extract-admonitions";

describe("extractAdmonitions", () => {
  it("returns empty for plain markdown", () => {
    expect(extractAdmonitions("Just some prose.\n\nNo callouts here.")).toEqual([]);
  });

  it("parses a colon-fence note", () => {
    const md = `:::{note}\nCircuits are immutable.\n:::`;
    expect(extractAdmonitions(md)).toEqual([
      { kind: "note", title: undefined, body: "Circuits are immutable." },
    ]);
  });

  it("captures the optional title argument", () => {
    const md = `:::{warning} Watch the shots\nMore shots = smoother decode.\n:::`;
    expect(extractAdmonitions(md)).toEqual([
      { kind: "warning", title: "Watch the shots", body: "More shots = smoother decode." },
    ]);
  });

  it("parses backtick-fence admonitions", () => {
    const md = "```{tip}\nUse 4096 shots as a default.\n```";
    expect(extractAdmonitions(md)).toEqual([
      { kind: "tip", title: undefined, body: "Use 4096 shots as a default." },
    ]);
  });

  it("skips unknown directive kinds", () => {
    const md = `:::{code-cell} python\nprint("hi")\n:::`;
    expect(extractAdmonitions(md)).toEqual([]);
  });

  it("extracts multiple admonitions in order", () => {
    const md = [
      ":::{note}",
      "First note.",
      ":::",
      "",
      "Some prose.",
      "",
      ":::{warning}",
      "Watch out.",
      ":::",
    ].join("\n");
    expect(extractAdmonitions(md).map((a) => a.kind)).toEqual(["note", "warning"]);
  });

  it("handles multiline bodies", () => {
    const md = [
      ":::{important}",
      "Line one.",
      "Line two.",
      "",
      "Line four.",
      ":::",
    ].join("\n");
    const out = extractAdmonitions(md);
    expect(out).toHaveLength(1);
    expect(out[0].body).toBe("Line one.\nLine two.\n\nLine four.");
  });
});
