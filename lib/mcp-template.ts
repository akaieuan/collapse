/**
 * MCP tool generation — the second output target of the Collapse template engine.
 *
 * Consumes the SAME `AnnotationSkillInput` shape `lib/skill-template.ts` eats and
 * emits a Node/TypeScript MCP server scaffold: a `{ files: {path, content}[] }`
 * object the persistence layer (`app/api/mcp-servers/route.ts`) writes atomically
 * to `~/.claude/mcp-servers/{name}/`.
 *
 * The scaffold registers exactly ONE tool over stdio. Its name/description derive
 * from the same trigger-phrase composition the skill template uses — we reuse the
 * exported `annotationTriggerPhrases` / `slugifyName` helpers rather than
 * duplicating them. The tool's handler returns the collapsed pattern (code +
 * annotations) as its response content — the "skill as a tool" shape: the exact
 * markdown `generateAnnotationSkillDraft` would have produced as a `SKILL.md`
 * body, now delivered through an invokable tool.
 *
 * Pure functions. No I/O. No async. Deterministic (golden-file testable).
 */
import {
  annotationTriggerPhrases,
  generateAnnotationSkillDraft,
  slugifyName,
  type AnnotationSkillInput,
} from "./skill-template";
import { ANNOTATION_KIND_LABEL, LANG_LABELS } from "./lessons/types";

/** Pinned so both the scaffold and the pre-push handshake gate resolve the same API surface. */
const MCP_SDK_RANGE = "^1.29.0";
const ZOD_RANGE = "^3.25.0";
const TSX_RANGE = "^4.23.0";
const TYPESCRIPT_RANGE = "^5.6.0";
const NODE_TYPES_RANGE = "^22.0.0";

export type McpScaffoldFile = {
  /** POSIX-relative path within the server directory (e.g. "src/index.ts"). */
  path: string;
  content: string;
};

export type McpScaffold = {
  /** kebab-case directory + npm package name (mirrors the derived skill name). */
  name: string;
  /** snake_case MCP tool name registered by the server. */
  toolName: string;
  /** Composed tool description, trigger phrases included. */
  description: string;
  files: McpScaffoldFile[];
  /** The `.mcp.json` stanza a user pastes to register the server. */
  register: string;
};

export type McpScaffoldOptions = {
  /** Override the derived directory/package name (kebab-cased defensively). */
  name?: string;
  /** Override the composed tool description (e.g. a user-edited one from the UI). */
  description?: string;
};

/** The derived server/package name — identical to the annotation skill name. */
export function mcpServerName(input: AnnotationSkillInput): string {
  return slugifyName(`${input.lang}-${input.annotationId}`);
}

/** MCP tool names are conventionally snake_case; derive one from the kebab server name. */
export function mcpToolName(serverName: string): string {
  return serverName.replace(/-/g, "_");
}

/**
 * Compose the tool description from the SAME trigger-phrase composition the skill
 * template uses (`annotationTriggerPhrases`), framed as a tool-invocation cue.
 */
export function composeToolDescription(input: AnnotationSkillInput): string {
  const langLabel = LANG_LABELS[input.lang];
  const kindLabel = ANNOTATION_KIND_LABEL[input.kind];
  const headline =
    input.remember || input.tip || `${langLabel} pattern: ${input.annotationId}`;
  const triggerPhrases = annotationTriggerPhrases(input).join(", ");
  return [
    `${langLabel} ${kindLabel.toLowerCase()}: ${headline}`,
    `Invoke this tool when the user is writing ${langLabel} code and needs this pattern applied or recalled.`,
    triggerPhrases ? `Trigger phrases: ${triggerPhrases}.` : "",
    `Collapse concept: ${input.lessonSlug}.`,
  ]
    .filter(Boolean)
    .join(" ");
}

/**
 * Generate the full MCP server scaffold for a single collapsed annotation.
 * The tool's response payload is the annotation skill body — the "skill as a tool".
 */
export function generateMcpScaffold(
  input: AnnotationSkillInput,
  opts: McpScaffoldOptions = {},
): McpScaffold {
  // Reuse the skill body composition verbatim → the tool returns exactly what a
  // SKILL.md would have carried (code + annotations), no duplicated formatting.
  const draft = generateAnnotationSkillDraft(input);
  const name = opts.name ? slugifyName(opts.name) : draft.name;
  const toolName = mcpToolName(name);
  const description = opts.description?.trim() || composeToolDescription(input);
  const patternDoc = draft.body;
  const register = renderRegister(name);

  const files: McpScaffoldFile[] = [
    { path: "package.json", content: renderPackageJson(name, toolName) },
    { path: "tsconfig.json", content: renderTsconfig() },
    {
      path: "src/index.ts",
      content: renderIndexTs({ name, toolName, description, patternDoc }),
    },
    { path: "mcp-register.json", content: register },
    { path: "README.md", content: renderReadme({ name, toolName, description, patternDoc }) },
  ];

  return { name, toolName, description, files, register };
}

// ---------------------------------------------------------------------------
// File renderers
// ---------------------------------------------------------------------------

function renderPackageJson(name: string, toolName: string): string {
  const pkg = {
    name,
    version: "0.1.0",
    private: true,
    description: `Collapse-generated MCP server exposing the ${toolName} tool.`,
    type: "module",
    bin: { [name]: "dist/index.js" },
    scripts: {
      build: "tsc",
      start: "node dist/index.js",
      dev: "tsx src/index.ts",
    },
    dependencies: {
      "@modelcontextprotocol/sdk": MCP_SDK_RANGE,
      zod: ZOD_RANGE,
    },
    devDependencies: {
      "@types/node": NODE_TYPES_RANGE,
      tsx: TSX_RANGE,
      typescript: TYPESCRIPT_RANGE,
    },
  };
  return JSON.stringify(pkg, null, 2) + "\n";
}

function renderTsconfig(): string {
  const tsconfig = {
    compilerOptions: {
      target: "ES2022",
      module: "NodeNext",
      moduleResolution: "NodeNext",
      lib: ["ES2022"],
      outDir: "dist",
      rootDir: "src",
      strict: true,
      esModuleInterop: true,
      skipLibCheck: true,
      declaration: false,
      resolveJsonModule: true,
    },
    include: ["src"],
  };
  return JSON.stringify(tsconfig, null, 2) + "\n";
}

function renderIndexTs(args: {
  name: string;
  toolName: string;
  description: string;
  patternDoc: string;
}): string {
  // JSON.stringify produces a valid double-quoted TS string literal with all
  // escaping handled — critical because `patternDoc` contains ``` code fences.
  const PATTERN = JSON.stringify(args.patternDoc);
  const DESCRIPTION = JSON.stringify(args.description);
  const TITLE = JSON.stringify(titleCase(args.name));
  const SERVER = JSON.stringify(args.name);
  const TOOL = JSON.stringify(args.toolName);

  return `/**
 * ${args.name} — a Collapse-generated MCP server.
 *
 * Registers a single tool (${args.toolName}) over stdio. Invoking the tool returns
 * the collapsed pattern (code + annotations) so Claude can apply it in-session.
 *
 * Run:  npx tsx src/index.ts     (dev)
 *       npm run build && npm start   (compiled)
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

/** The collapsed pattern — the "skill as a tool" payload. */
const PATTERN = ${PATTERN};

const server = new McpServer({ name: ${SERVER}, version: "0.1.0" });

server.registerTool(
  ${TOOL},
  {
    title: ${TITLE},
    description: ${DESCRIPTION},
    inputSchema: {
      context: z
        .string()
        .optional()
        .describe("Optional context about what the caller is trying to build."),
    },
  },
  async ({ context }) => {
    const preamble = context ? \`Context: \${context}\\n\\n\` : "";
    return {
      content: [{ type: "text", text: preamble + PATTERN }],
    };
  },
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // stderr keeps stdout clean for the JSON-RPC stream.
  process.stderr.write(${SERVER} + " MCP server ready on stdio\\n");
}

main().catch((err) => {
  process.stderr.write(\`fatal: \${err instanceof Error ? err.stack : String(err)}\\n\`);
  process.exit(1);
});
`;
}

function renderRegister(name: string): string {
  const stanza = {
    mcpServers: {
      [name]: {
        command: "npx",
        args: ["tsx", "src/index.ts"],
      },
    },
  };
  return JSON.stringify(stanza, null, 2) + "\n";
}

function renderReadme(args: {
  name: string;
  toolName: string;
  description: string;
  patternDoc: string;
}): string {
  return [
    `# ${args.name}`,
    "",
    "A Collapse-generated [Model Context Protocol](https://modelcontextprotocol.io) server.",
    `It registers a single tool, \`${args.toolName}\`, that returns a collapsed code pattern.`,
    "",
    "## Install & run",
    "",
    "```bash",
    "npm install",
    "npx tsx src/index.ts   # dev: run straight from TypeScript over stdio",
    "# or, compiled:",
    "npm run build && npm start",
    "```",
    "",
    "## Register with Claude Code",
    "",
    "Paste `mcp-register.json` into your `.mcp.json` (merge under `mcpServers`).",
    "Run the server from this directory, or set an absolute path in the `args`.",
    "",
    "```json",
    JSON.stringify(
      { mcpServers: { [args.name]: { command: "npx", args: ["tsx", "src/index.ts"] } } },
      null,
      2,
    ),
    "```",
    "",
    "## The tool",
    "",
    `**${args.toolName}** — ${args.description}`,
    "",
    "It returns the following pattern:",
    "",
    "---",
    "",
    args.patternDoc.trimEnd(),
    "",
  ].join("\n");
}

function titleCase(kebab: string): string {
  return kebab
    .split("-")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}
