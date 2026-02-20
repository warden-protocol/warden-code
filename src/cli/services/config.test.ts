import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";

// Mock os.homedir to use a temp directory instead of the real home
let fakeHome: string;

vi.mock("node:os", async () => {
  const actual = await vi.importActual<typeof import("node:os")>("node:os");
  return {
    ...actual,
    homedir: () => fakeHome,
  };
});

// Import after mock setup
const { readConfig, writeConfig } = await import("./config.js");

describe("config", () => {
  beforeEach(async () => {
    fakeHome = await fs.mkdtemp(
      path.join(os.tmpdir(), "warden-config-test-"),
    );
  });

  afterEach(async () => {
    try {
      await fs.rm(fakeHome, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe("readConfig", () => {
    it("should return null when config does not exist", async () => {
      const config = await readConfig();
      expect(config).toBeNull();
    });

    it("should read a valid config", async () => {
      const configDir = path.join(fakeHome, ".warden");
      await fs.mkdir(configDir, { recursive: true });
      await fs.writeFile(
        path.join(configDir, "config.json"),
        JSON.stringify({
          provider: "openai",
          model: "gpt-4o",
          apiKey: "sk-test",
        }),
      );

      const config = await readConfig();
      expect(config).toEqual({
        provider: "openai",
        model: "gpt-4o",
        apiKey: "sk-test",
      });
    });

    it("should return null for malformed JSON", async () => {
      const configDir = path.join(fakeHome, ".warden");
      await fs.mkdir(configDir, { recursive: true });
      await fs.writeFile(
        path.join(configDir, "config.json"),
        "not valid json",
      );

      const config = await readConfig();
      expect(config).toBeNull();
    });
  });

  describe("writeConfig", () => {
    it("should create the config directory and write the file", async () => {
      await writeConfig({
        provider: "anthropic",
        model: "claude-sonnet-4-20250514",
        apiKey: "sk-ant-test",
      });

      const content = await fs.readFile(
        path.join(fakeHome, ".warden", "config.json"),
        "utf-8",
      );
      const parsed = JSON.parse(content);
      expect(parsed.provider).toBe("anthropic");
      expect(parsed.model).toBe("claude-sonnet-4-20250514");
      expect(parsed.apiKey).toBe("sk-ant-test");
    });

    it("should overwrite an existing config", async () => {
      await writeConfig({
        provider: "openai",
        model: "gpt-4o",
        apiKey: "old-key",
      });
      await writeConfig({
        provider: "openai",
        model: "gpt-4o-mini",
        apiKey: "new-key",
      });

      const config = await readConfig();
      expect(config?.model).toBe("gpt-4o-mini");
      expect(config?.apiKey).toBe("new-key");
    });
  });
});
