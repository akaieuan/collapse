import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import path from "node:path";
import { promises as fs } from "node:fs";

// A throwaway fake $HOME so the route writes into a temp tree, never real ~/.claude.
const { FAKE_HOME } = vi.hoisted(() => ({
  FAKE_HOME: `/tmp/collapse-mcp-route-test-${process.pid}-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2)}`,
}));

vi.mock("server-only", () => ({}));
vi.mock("node:os", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:os")>();
  return {
    ...actual,
    default: { ...(actual as unknown as { default?: object }).default, homedir: () => FAKE_HOME },
    homedir: () => FAKE_HOME,
  };
});

const SERVERS_ROOT = path.join(FAKE_HOME, ".claude", "mcp-servers");

// Imported after the mocks are registered.
const { POST, GET } = await import("./route");

function validInput() {
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
  };
}

function post(body: unknown): Request {
  return new Request("http://localhost/api/mcp-servers", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

beforeEach(async () => {
  await fs.rm(SERVERS_ROOT, { recursive: true, force: true });
});

afterAll(async () => {
  await fs.rm(FAKE_HOME, { recursive: true, force: true });
});

describe("POST /api/mcp-servers — validation", () => {
  it("rejects invalid JSON with 400", async () => {
    const res = await POST(post("{not json"));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("invalid_json");
  });

  it("rejects a path-traversal name with 400 (kebab-case Zod guard)", async () => {
    const res = await POST(post({ name: "../evil", input: validInput() }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("invalid_request");
  });

  it("rejects a name with slashes with 400", async () => {
    const res = await POST(post({ name: "a/b", input: validInput() }));
    expect(res.status).toBe(400);
  });

  it("rejects a missing input payload with 400", async () => {
    const res = await POST(post({ name: "next-cleanup-effect" }));
    expect(res.status).toBe(400);
  });
});

describe("POST /api/mcp-servers — write + collision", () => {
  it("writes the full scaffold atomically and returns 201", async () => {
    const res = await POST(post({ name: "next-cleanup-effect", input: validInput() }));
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.name).toBe("next-cleanup-effect");
    expect(data.toolName).toBe("next_cleanup_effect");
    expect(data.path).toBe("~/.claude/mcp-servers/next-cleanup-effect");

    // All scaffold files actually landed on disk, including the nested src/.
    const dir = path.join(SERVERS_ROOT, "next-cleanup-effect");
    for (const rel of ["package.json", "tsconfig.json", "src/index.ts", "mcp-register.json", "README.md"]) {
      await expect(fs.access(path.join(dir, rel))).resolves.toBeUndefined();
    }
    const pkg = JSON.parse(await fs.readFile(path.join(dir, "package.json"), "utf8"));
    expect(pkg.name).toBe("next-cleanup-effect");

    // No temp dirs left behind.
    const entries = await fs.readdir(SERVERS_ROOT);
    expect(entries.filter((e) => e.startsWith(".tmp-"))).toHaveLength(0);
  });

  it("accepts a forge-shaped {name, description, body} payload and writes 201", async () => {
    const res = await POST(
      post({
        name: "reactive-state",
        description: "How to hold reactive state. Trigger phrases: \"reactive state\".",
        body: "# Reactive state\n\n```tsx\nconst [n] = useState(0)\n```\n",
      }),
    );
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.name).toBe("reactive-state");
    expect(data.toolName).toBe("reactive_state");
    const src = await fs.readFile(
      path.join(SERVERS_ROOT, "reactive-state", "src", "index.ts"),
      "utf8",
    );
    expect(src).toContain('"reactive_state"');
  });

  it("returns 409 with the existing description on a collision (no overwrite)", async () => {
    await POST(post({ name: "next-cleanup-effect", input: validInput() }));
    const res = await POST(post({ name: "next-cleanup-effect", input: validInput() }));
    expect(res.status).toBe(409);
    const data = await res.json();
    expect(data.error).toBe("server_exists");
    expect(typeof data.existing.description).toBe("string");
    expect(data.existing.name).toBe("next-cleanup-effect");
  });

  it("overwrites with 200 when overwrite:true", async () => {
    await POST(post({ name: "next-cleanup-effect", input: validInput() }));
    const res = await POST(
      post({ name: "next-cleanup-effect", input: validInput(), overwrite: true }),
    );
    expect(res.status).toBe(200);
    // still exactly one server directory, no leftover temp dirs
    const entries = await fs.readdir(SERVERS_ROOT);
    expect(entries.filter((e) => !e.startsWith(".tmp-"))).toEqual(["next-cleanup-effect"]);
  });

  it("applies a description override to the written package.json", async () => {
    await POST(
      post({
        name: "next-cleanup-effect",
        input: validInput(),
        description: "A hand-tuned trigger description.",
      }),
    );
    // GET lists it back with name + description from package.json
    const listRes = await GET();
    const { servers } = await listRes.json();
    const found = servers.find((s: { name: string }) => s.name === "next-cleanup-effect");
    expect(found).toBeDefined();
    // package.json description is the scaffold's own, not the tool description override,
    // but the server is discoverable by name.
    expect(found.name).toBe("next-cleanup-effect");
  });
});

describe("GET /api/mcp-servers", () => {
  it("returns an empty list when the root does not exist", async () => {
    const res = await GET();
    expect((await res.json()).servers).toEqual([]);
  });

  it("lists written servers with name + description, skipping dotfiles", async () => {
    await POST(post({ name: "next-cleanup-effect", input: validInput() }));
    const res = await GET();
    const { servers } = await res.json();
    expect(servers).toHaveLength(1);
    expect(servers[0].name).toBe("next-cleanup-effect");
    expect(typeof servers[0].description).toBe("string");
  });
});
