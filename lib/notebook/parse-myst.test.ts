import { describe, expect, it } from "vitest";
import { parseMyst } from "./parse-myst";

describe("parseMyst", () => {
  it("parses a markdown-only chapter as a single markdown cell", () => {
    const md = "# Quantum gates\n\nIntro prose only.";
    const result = parseMyst(md);
    expect(result.cells).toHaveLength(1);
    expect(result.cells[0].type).toBe("markdown");
    expect(result.cells[0].source).toBe(md);
  });

  it("splits markdown around a code-cell directive", () => {
    const md = [
      "# Teleportation",
      "",
      "Build the circuit:",
      "",
      "```{code-cell} python",
      "qc = QuantumCircuit(3, 3)",
      "qc.h(1)",
      "```",
      "",
      "Then measure.",
    ].join("\n");
    const result = parseMyst(md);
    expect(result.cells.map((c) => c.type)).toEqual([
      "markdown",
      "code",
      "markdown",
    ]);
    expect(result.cells[1]).toMatchObject({
      type: "code",
      language: "python",
    });
    expect(result.cells[1].source).toBe("qc = QuantumCircuit(3, 3)\nqc.h(1)");
  });

  it("infers language from the first code-cell directive", () => {
    const md = "```{code-cell} python\nx = 1\n```";
    expect(parseMyst(md).language).toBe("python");
  });

  it("falls back to python when no code-cell present", () => {
    expect(parseMyst("# Prose only").language).toBe("python");
  });

  it("extracts admonitions inside markdown cells", () => {
    const md = [
      "# Chapter",
      "",
      ":::{warning}",
      "Watch the shots.",
      ":::",
      "",
      "```{code-cell} python",
      "x = 1",
      "```",
    ].join("\n");
    const result = parseMyst(md);
    expect(result.cells[0].admonitions).toEqual([
      { kind: "warning", title: undefined, body: "Watch the shots." },
    ]);
  });

  it("strips a YAML frontmatter block when inferring the title", () => {
    const md = [
      "---",
      "title: Frontmatter title",
      "---",
      "",
      "# Real H1 title",
      "",
      "Body.",
    ].join("\n");
    expect(parseMyst(md).title).toBe("Real H1 title");
  });

  it("handles multiple code cells in order", () => {
    const md = [
      "```{code-cell} python",
      "a = 1",
      "```",
      "",
      "Between.",
      "",
      "```{code-cell} python",
      "b = 2",
      "```",
    ].join("\n");
    const result = parseMyst(md);
    expect(result.cells.map((c) => c.type)).toEqual([
      "code",
      "markdown",
      "code",
    ]);
  });
});
