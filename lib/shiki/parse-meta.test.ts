import { describe, expect, it } from "vitest";
import { buildLineMap, extractAttr, parseAnnotMeta } from "./parse-meta";

describe("parseAnnotMeta", () => {
  it("returns empty for falsy input", () => {
    expect(parseAnnotMeta(undefined)).toEqual([]);
    expect(parseAnnotMeta(null)).toEqual([]);
    expect(parseAnnotMeta("")).toEqual([]);
  });

  it("parses single line anchor", () => {
    expect(parseAnnotMeta("{4#use-client}")).toEqual([{ lines: [4], id: "use-client" }]);
  });

  it("parses range anchor", () => {
    expect(parseAnnotMeta("{4-6#useState}")).toEqual([
      { lines: [4, 5, 6], id: "useState" },
    ]);
  });

  it("parses comma-separated lines", () => {
    expect(parseAnnotMeta("{1,3,5#imports}")).toEqual([
      { lines: [1, 3, 5], id: "imports" },
    ]);
  });

  it("parses mixed range + single", () => {
    expect(parseAnnotMeta("{4-5,8#mixed}")).toEqual([
      { lines: [4, 5, 8], id: "mixed" },
    ]);
  });

  it("parses multiple anchors in one block separated by whitespace", () => {
    expect(parseAnnotMeta("{4-5#a 7#b}")).toEqual([
      { lines: [4, 5], id: "a" },
      { lines: [7], id: "b" },
    ]);
  });

  it("parses multiple anchor blocks", () => {
    expect(parseAnnotMeta("{1#first} {3-4#second}")).toEqual([
      { lines: [1], id: "first" },
      { lines: [3, 4], id: "second" },
    ]);
  });

  it("ignores anchors without ids", () => {
    expect(parseAnnotMeta("{4-5}")).toEqual([]);
  });

  it("ignores invalid line numbers", () => {
    expect(parseAnnotMeta("{0#zero 5-3#backwards abc#word}")).toEqual([]);
  });

  it("rejects ids with disallowed characters", () => {
    expect(parseAnnotMeta("{4#has.dot}")).toEqual([]);
    expect(parseAnnotMeta("{4#has_underscore}")).toEqual([]);
  });

  it("treats space inside an anchor as a separator (consume valid prefix only)", () => {
    expect(parseAnnotMeta("{4#first 6#second}")).toEqual([
      { lines: [4], id: "first" },
      { lines: [6], id: "second" },
    ]);
  });

  it("ignores meta that has no annotation block", () => {
    expect(parseAnnotMeta('title="Counter.vue"')).toEqual([]);
  });

  it("handles annotation block alongside other meta attributes", () => {
    expect(parseAnnotMeta('title="x.ts" {3-4#hook} lang=ts')).toEqual([
      { lines: [3, 4], id: "hook" },
    ]);
  });

  it("dedupes overlapping lines preserving the first id", () => {
    const map = buildLineMap(parseAnnotMeta("{3-5#a 4-6#b}"));
    expect(map.get(3)).toBe("a");
    expect(map.get(4)).toBe("a");
    expect(map.get(5)).toBe("a");
    expect(map.get(6)).toBe("b");
  });

  it("rejects giant ranges", () => {
    expect(parseAnnotMeta("{1-10000#huge}")).toEqual([]);
  });
});

describe("extractAttr", () => {
  it("pulls a quoted attribute", () => {
    expect(extractAttr('title="Counter.vue"', "title")).toBe("Counter.vue");
  });

  it("returns undefined when missing", () => {
    expect(extractAttr("{1#x}", "title")).toBeUndefined();
  });
});
