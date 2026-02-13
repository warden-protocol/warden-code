import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";
import { readAgentUrl } from "./build.js";

describe("readAgentUrl", () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), "warden-build-test-"));
  });

  afterEach(async () => {
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  it("should return AGENT_URL value from .env", async () => {
    await fs.writeFile(
      path.join(testDir, ".env"),
      "HOST=localhost\nPORT=3000\nAGENT_URL=http://localhost:3000\n",
    );
    expect(await readAgentUrl(testDir)).toBe("http://localhost:3000");
  });

  it("should return null when .env does not exist", async () => {
    expect(await readAgentUrl(testDir)).toBeNull();
  });

  it("should return null when AGENT_URL is not in .env", async () => {
    await fs.writeFile(
      path.join(testDir, ".env"),
      "HOST=localhost\nPORT=3000\n",
    );
    expect(await readAgentUrl(testDir)).toBeNull();
  });

  it("should return null when AGENT_URL is empty", async () => {
    await fs.writeFile(path.join(testDir, ".env"), "AGENT_URL=\n");
    expect(await readAgentUrl(testDir)).toBeNull();
  });

  it("should handle AGENT_URL with trailing whitespace", async () => {
    await fs.writeFile(
      path.join(testDir, ".env"),
      "AGENT_URL=http://localhost:3000   \n",
    );
    expect(await readAgentUrl(testDir)).toBe("http://localhost:3000");
  });

  it("should return first AGENT_URL when duplicated", async () => {
    await fs.writeFile(
      path.join(testDir, ".env"),
      "AGENT_URL=http://first:3000\nAGENT_URL=http://second:4000\n",
    );
    expect(await readAgentUrl(testDir)).toBe("http://first:3000");
  });

  it("should skip comments and blank lines", async () => {
    await fs.writeFile(
      path.join(testDir, ".env"),
      "# comment\n\nAGENT_URL=http://localhost:5000\n",
    );
    expect(await readAgentUrl(testDir)).toBe("http://localhost:5000");
  });

  it("should handle .env with only AGENT_URL", async () => {
    await fs.writeFile(
      path.join(testDir, ".env"),
      "AGENT_URL=https://prod.example.com",
    );
    expect(await readAgentUrl(testDir)).toBe("https://prod.example.com");
  });
});
