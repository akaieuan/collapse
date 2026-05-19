import { describe, expect, it } from "vitest";
import { parseIpynb, IpynbParseError } from "./parse-ipynb";

function ipynb(obj: unknown): string {
  return JSON.stringify(obj);
}

describe("parseIpynb", () => {
  it("throws on invalid JSON", () => {
    expect(() => parseIpynb("not json")).toThrow(IpynbParseError);
  });

  it("throws when cells array is missing", () => {
    expect(() => parseIpynb(ipynb({ metadata: {} }))).toThrow(IpynbParseError);
  });

  it("parses a minimal notebook with one code cell", () => {
    const result = parseIpynb(
      ipynb({
        cells: [
          { cell_type: "code", source: "print('hi')\n", metadata: {} },
        ],
        metadata: { kernelspec: { language: "python" } },
      }),
    );
    expect(result.source).toBe("ipynb");
    expect(result.language).toBe("python");
    expect(result.cells).toHaveLength(1);
    expect(result.cells[0]).toMatchObject({
      type: "code",
      source: "print('hi')\n",
      language: "python",
    });
  });

  it("joins source arrays correctly (Jupyter preserves \\n on each line)", () => {
    const result = parseIpynb(
      ipynb({
        cells: [
          {
            cell_type: "code",
            source: ["import numpy as np\n", "x = np.array([1,2,3])\n"],
          },
        ],
        metadata: { kernelspec: { language: "python" } },
      }),
    );
    expect(result.cells[0].source).toBe(
      "import numpy as np\nx = np.array([1,2,3])\n",
    );
  });

  it("extracts admonitions from markdown cells", () => {
    const result = parseIpynb(
      ipynb({
        cells: [
          {
            cell_type: "markdown",
            source: "# Title\n\n:::{tip}\nUse 4096 shots.\n:::",
          },
          { cell_type: "code", source: "x = 1\n" },
        ],
        metadata: { kernelspec: { language: "python" } },
      }),
    );
    expect(result.cells[0].admonitions).toEqual([
      { kind: "tip", title: undefined, body: "Use 4096 shots." },
    ]);
    expect(result.cells[1].admonitions).toEqual([]);
  });

  it("infers the title from the first markdown H1", () => {
    const result = parseIpynb(
      ipynb({
        cells: [
          { cell_type: "markdown", source: "# Quantum teleportation\n\nIntro." },
          { cell_type: "code", source: "x = 1" },
        ],
        metadata: {},
      }),
    );
    expect(result.title).toBe("Quantum teleportation");
  });

  it("skips empty and raw cells", () => {
    const result = parseIpynb(
      ipynb({
        cells: [
          { cell_type: "raw", source: "ignored" },
          { cell_type: "code", source: "   \n   " },
          { cell_type: "code", source: "x = 1" },
        ],
        metadata: {},
      }),
    );
    expect(result.cells).toHaveLength(1);
    expect(result.cells[0].source).toBe("x = 1");
  });

  it("falls back to language_info when kernelspec.language missing", () => {
    const result = parseIpynb(
      ipynb({
        cells: [{ cell_type: "code", source: "x = 1" }],
        metadata: { language_info: { name: "julia" } },
      }),
    );
    expect(result.language).toBe("julia");
  });
});
