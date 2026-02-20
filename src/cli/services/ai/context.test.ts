import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";
import {
  buildProjectContext,
  parseResponse,
  applyChanges,
  type FileChange,
} from "./context.js";

describe("buildProjectContext", () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(
      path.join(os.tmpdir(), "warden-context-test-"),
    );
  });

  afterEach(async () => {
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  it("should include existing project files", async () => {
    await fs.mkdir(path.join(testDir, "src"), { recursive: true });
    await fs.writeFile(
      path.join(testDir, "src/agent.ts"),
      "export const handler = () => {};",
    );
    await fs.writeFile(
      path.join(testDir, "package.json"),
      '{"name":"test"}',
    );

    const context = await buildProjectContext(testDir);

    expect(context).toContain("--- src/agent.ts ---");
    expect(context).toContain("export const handler = () => {};");
    expect(context).toContain("--- package.json ---");
    expect(context).toContain('{"name":"test"}');
  });

  it("should skip missing project files", async () => {
    const context = await buildProjectContext(testDir);
    expect(context).toBe("");
  });

  it("should include agent-kit type definitions when present", async () => {
    const typesDir = path.join(
      testDir,
      "node_modules/@wardenprotocol/agent-kit/dist/a2a",
    );
    await fs.mkdir(typesDir, { recursive: true });
    await fs.writeFile(
      path.join(typesDir, "types.d.ts"),
      "export interface TaskContext {}",
    );

    const context = await buildProjectContext(testDir);

    expect(context).toContain(
      "--- node_modules/@wardenprotocol/agent-kit/dist/a2a/types.d.ts ---",
    );
    expect(context).toContain("export interface TaskContext {}");
  });

  it("should skip agent-kit types when package is not installed", async () => {
    await fs.mkdir(path.join(testDir, "src"), { recursive: true });
    await fs.writeFile(
      path.join(testDir, "src/agent.ts"),
      "handler code",
    );

    const context = await buildProjectContext(testDir);

    expect(context).not.toContain("node_modules");
    expect(context).toContain("--- src/agent.ts ---");
  });
});

describe("parseResponse", () => {
  it("should extract annotated code blocks", () => {
    const response = [
      "I updated the agent handler.",
      "",
      "```typescript:src/agent.ts",
      'export const handler = () => "hello";',
      "```",
    ].join("\n");

    const { text, changes } = parseResponse(response);

    expect(changes).toHaveLength(1);
    expect(changes[0]!.filePath).toBe("src/agent.ts");
    expect(changes[0]!.content).toBe(
      'export const handler = () => "hello";\n',
    );
    expect(text).toBe("I updated the agent handler.");
  });

  it("should extract multiple code blocks", () => {
    const response = [
      "Updated both files.",
      "",
      "```typescript:src/agent.ts",
      "agent code",
      "```",
      "",
      "```json:package.json",
      '{"name":"test"}',
      "```",
    ].join("\n");

    const { changes } = parseResponse(response);

    expect(changes).toHaveLength(2);
    expect(changes[0]!.filePath).toBe("src/agent.ts");
    expect(changes[1]!.filePath).toBe("package.json");
  });

  it("should return empty changes for plain text", () => {
    const { text, changes } = parseResponse("Just a text response.");
    expect(changes).toHaveLength(0);
    expect(text).toBe("Just a text response.");
  });

  it("should ignore unannotated code blocks", () => {
    const response = [
      "Here is an example:",
      "",
      "```typescript",
      "const x = 1;",
      "```",
    ].join("\n");

    const { changes } = parseResponse(response);
    expect(changes).toHaveLength(0);
  });

  it("should trim whitespace from file paths", () => {
    const response = [
      "```typescript:  src/agent.ts  ",
      "code",
      "```",
    ].join("\n");

    const { changes } = parseResponse(response);
    expect(changes[0]!.filePath).toBe("src/agent.ts");
  });
});

describe("applyChanges", () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(
      path.join(os.tmpdir(), "warden-apply-test-"),
    );
  });

  afterEach(async () => {
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  it("should write files and return applied paths", async () => {
    const changes: FileChange[] = [
      { filePath: "src/agent.ts", content: "new agent code" },
    ];

    const applied = await applyChanges(testDir, changes);

    expect(applied).toEqual(["src/agent.ts"]);
    const written = await fs.readFile(
      path.join(testDir, "src/agent.ts"),
      "utf-8",
    );
    expect(written).toBe("new agent code");
  });

  it("should create directories as needed", async () => {
    const changes: FileChange[] = [
      { filePath: "src/deep/nested/file.ts", content: "nested" },
    ];

    const applied = await applyChanges(testDir, changes);

    expect(applied).toEqual(["src/deep/nested/file.ts"]);
    const written = await fs.readFile(
      path.join(testDir, "src/deep/nested/file.ts"),
      "utf-8",
    );
    expect(written).toBe("nested");
  });

  it("should return empty array for no changes", async () => {
    const applied = await applyChanges(testDir, []);
    expect(applied).toEqual([]);
  });
});
