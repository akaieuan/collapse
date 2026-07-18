import { describe, expect, it } from "vitest";
import {
  composeToolDescription,
  generateMcpScaffold,
  generateMcpScaffoldFromSkill,
  mcpServerName,
  mcpToolName,
  type McpScaffold,
} from "./mcp-template";
import {
  annotationTriggerPhrases,
  generateAnnotationSkillDraft,
  type AnnotationSkillInput,
} from "./skill-template";

// ---------------------------------------------------------------------------
// Fixtures (mirror lib/skill-template.test.ts so the two engines stay comparable)
// ---------------------------------------------------------------------------

function annotationInput(
  overrides: Partial<AnnotationSkillInput> = {},
): AnnotationSkillInput {
  return {
    lessonSlug: "use-debounced-value",
    lessonTitle: "useDebouncedValue hook",
    lang: "next",
    shikiLang: "tsx",
    annotationId: "cleanup-effect",
    kind: "core",
    tip: "return a cleanup to clear the pending timer",
    remember: "clean up on every change",
    body: "The cleanup runs before the next effect, cancelling the stale timer.",
    detail: "Without it, a fast-changing value schedules overlapping timers.",
    codeSnippet:
      "useEffect(() => {\n  const id = setTimeout(fn, delay);\n  return () => clearTimeout(id);\n}, [value, delay]);",
    ...overrides,
  };
}

function fileByPath(scaffold: McpScaffold, p: string): string {
  const f = scaffold.files.find((x) => x.path === p);
  if (!f) throw new Error(`scaffold missing file ${p}`);
  return f.content;
}

/** Count individually-quoted phrases inside a "Trigger phrases: …" clause. */
function triggerPhrases(description: string): string[] {
  const m = /Trigger phrases: (.+?)\.\s+Collapse concept:/.exec(description);
  if (!m) return [];
  return m[1].match(/"[^"]*"/g) ?? [];
}

// ---------------------------------------------------------------------------
// Naming
// ---------------------------------------------------------------------------

describe("mcpServerName / mcpToolName", () => {
  it("derives the kebab server name from lang + annotationId (same as the skill name)", () => {
    expect(mcpServerName(annotationInput())).toBe("next-cleanup-effect");
    // parity with the skill draft name is the whole point of sharing the helper
    expect(mcpServerName(annotationInput())).toBe(
      generateAnnotationSkillDraft(annotationInput()).name,
    );
  });

  it("snake_cases the tool name from the kebab server name", () => {
    expect(mcpToolName("next-cleanup-effect")).toBe("next_cleanup_effect");
  });
});

// ---------------------------------------------------------------------------
// composeToolDescription — reuses the shared trigger-phrase composition
// ---------------------------------------------------------------------------

describe("composeToolDescription", () => {
  it("composes the full tool description (golden)", () => {
    expect(composeToolDescription(annotationInput())).toBe(
      "Next.js core concept: clean up on every change " +
        "Invoke this tool when the user is writing Next.js code and needs this pattern applied or recalled. " +
        'Trigger phrases: "return a cleanup to clear the pending timer", "clean up on every change", "next cleanup effect". ' +
        "Collapse concept: use-debounced-value.",
    );
  });

  it("reuses the exact trigger phrases from the shared skill-template helper", () => {
    const desc = composeToolDescription(annotationInput());
    const fromDescription = triggerPhrases(desc);
    const fromHelper = annotationTriggerPhrases(annotationInput());
    expect(fromDescription).toEqual(fromHelper);
    expect(fromDescription.length).toBeLessThanOrEqual(5);
  });

  it("falls back to a synthetic headline when tip and remember are empty", () => {
    const desc = composeToolDescription(annotationInput({ tip: "", remember: "" }));
    expect(desc).toContain("Next.js core concept: Next.js pattern: cleanup-effect");
    expect(triggerPhrases(desc)).toEqual(['"next cleanup effect"']);
  });
});

// ---------------------------------------------------------------------------
// generateMcpScaffold — file set + contents
// ---------------------------------------------------------------------------

describe("generateMcpScaffold", () => {
  it("emits exactly the expected file set", () => {
    const scaffold = generateMcpScaffold(annotationInput());
    expect(scaffold.files.map((f) => f.path).sort()).toEqual([
      "README.md",
      "mcp-register.json",
      "package.json",
      "src/index.ts",
      "tsconfig.json",
    ]);
    expect(scaffold.name).toBe("next-cleanup-effect");
    expect(scaffold.toolName).toBe("next_cleanup_effect");
  });

  it("package.json names the package, pins the SDK + zod, and wires a stdio bin", () => {
    const pkg = JSON.parse(fileByPath(generateMcpScaffold(annotationInput()), "package.json"));
    expect(pkg.name).toBe("next-cleanup-effect");
    expect(pkg.type).toBe("module");
    expect(pkg.dependencies["@modelcontextprotocol/sdk"]).toMatch(/^\^1\./);
    expect(pkg.dependencies.zod).toBeDefined();
    expect(pkg.devDependencies.tsx).toBeDefined();
    expect(pkg.devDependencies.typescript).toBeDefined();
    expect(pkg.bin["next-cleanup-effect"]).toBe("dist/index.js");
    expect(pkg.scripts.dev).toBe("tsx src/index.ts");
  });

  it("tsconfig.json targets NodeNext ESM", () => {
    const tsconfig = JSON.parse(fileByPath(generateMcpScaffold(annotationInput()), "tsconfig.json"));
    expect(tsconfig.compilerOptions.module).toBe("NodeNext");
    expect(tsconfig.compilerOptions.moduleResolution).toBe("NodeNext");
    expect(tsconfig.compilerOptions.strict).toBe(true);
  });

  it("src/index.ts registers ONE tool over stdio with the composed description", () => {
    const src = fileByPath(generateMcpScaffold(annotationInput()), "src/index.ts");
    expect(src).toContain('from "@modelcontextprotocol/sdk/server/mcp.js"');
    expect(src).toContain('from "@modelcontextprotocol/sdk/server/stdio.js"');
    expect(src).toContain("new StdioServerTransport()");
    expect(src).toContain("server.registerTool(");
    // exactly one registered tool
    expect(src.match(/server\.registerTool\(/g)).toHaveLength(1);
    // tool name (snake_case) and server name embedded as JSON string literals
    expect(src).toContain('"next_cleanup_effect"');
    expect(src).toContain(JSON.stringify(composeToolDescription(annotationInput())));
  });

  it("embeds the skill body verbatim as the tool response payload (skill-as-a-tool)", () => {
    const input = annotationInput();
    const src = fileByPath(generateMcpScaffold(input), "src/index.ts");
    const body = generateAnnotationSkillDraft(input).body;
    // The pattern is embedded via JSON.stringify → safe past the ``` code fences.
    expect(src).toContain(`const PATTERN = ${JSON.stringify(body)};`);
    // and it round-trips back to the exact collapsed pattern (single-line literal)
    const prefix = "const PATTERN = ";
    const line = src.split("\n").find((l) => l.startsWith(prefix));
    expect(line).toBeDefined();
    const literal = line!.slice(prefix.length, -1); // strip trailing ";"
    expect(JSON.parse(literal)).toBe(body);
  });

  it("mcp-register.json is a pasteable .mcp.json stanza running npx tsx src/index.ts", () => {
    const scaffold = generateMcpScaffold(annotationInput());
    const stanza = JSON.parse(fileByPath(scaffold, "mcp-register.json"));
    expect(stanza.mcpServers["next-cleanup-effect"]).toEqual({
      command: "npx",
      args: ["tsx", "src/index.ts"],
    });
    // `register` convenience field mirrors the file
    expect(scaffold.register).toBe(fileByPath(scaffold, "mcp-register.json"));
  });

  it("honors a name override (dir/package/tool all follow it)", () => {
    const scaffold = generateMcpScaffold(annotationInput(), { name: "my-custom-tool" });
    expect(scaffold.name).toBe("my-custom-tool");
    expect(scaffold.toolName).toBe("my_custom_tool");
    const pkg = JSON.parse(fileByPath(scaffold, "package.json"));
    expect(pkg.name).toBe("my-custom-tool");
    expect(fileByPath(scaffold, "src/index.ts")).toContain('"my_custom_tool"');
  });

  it("honors a description override (e.g. a user-edited one from the UI)", () => {
    const scaffold = generateMcpScaffold(annotationInput(), {
      description: "Custom trigger description with a phrase.",
    });
    expect(scaffold.description).toBe("Custom trigger description with a phrase.");
    expect(fileByPath(scaffold, "src/index.ts")).toContain(
      JSON.stringify("Custom trigger description with a phrase."),
    );
  });

  it("defensively kebab-cases a messy name override", () => {
    const scaffold = generateMcpScaffold(annotationInput(), { name: "My Messy Name!!" });
    expect(scaffold.name).toBe("my-messy-name");
    expect(scaffold.toolName).toBe("my_messy_name");
  });
});

// ---------------------------------------------------------------------------
// generateMcpScaffoldFromSkill — the forge-draft path ({name, description, body})
// ---------------------------------------------------------------------------

describe("generateMcpScaffoldFromSkill", () => {
  const draft = {
    name: "reactive-state",
    description: "How to hold and update reactive state. Trigger phrases: \"reactive state\".",
    body: "# Reactive state\n\n```tsx\nconst [n, setN] = useState(0)\n```\n",
  };

  it("builds the same file set from a composed skill draft", () => {
    const scaffold = generateMcpScaffoldFromSkill(draft);
    expect(scaffold.name).toBe("reactive-state");
    expect(scaffold.toolName).toBe("reactive_state");
    expect(scaffold.description).toBe(draft.description);
    expect(scaffold.files.map((f) => f.path).sort()).toEqual([
      "README.md",
      "mcp-register.json",
      "package.json",
      "src/index.ts",
      "tsconfig.json",
    ]);
  });

  it("embeds the draft body as the tool payload", () => {
    const scaffold = generateMcpScaffoldFromSkill(draft);
    expect(fileByPath(scaffold, "src/index.ts")).toContain(
      `const PATTERN = ${JSON.stringify(draft.body)};`,
    );
  });

  it("honors name + description overrides and kebab-cases the name", () => {
    const scaffold = generateMcpScaffoldFromSkill(draft, {
      name: "Renamed Tool",
      description: "Overridden.",
    });
    expect(scaffold.name).toBe("renamed-tool");
    expect(scaffold.toolName).toBe("renamed_tool");
    expect(scaffold.description).toBe("Overridden.");
  });
});
