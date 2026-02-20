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
const {
  readConfig,
  readMultiConfig,
  writeConfig,
  activeKey,
  parseActive,
  toBuildConfig,
  updateProvider,
} = await import("./config.js");

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

  // ── Pure helpers ────────────────────────────────────────

  describe("activeKey", () => {
    it("should join provider and model with a slash", () => {
      expect(activeKey("openai", "gpt-5.2-codex")).toBe(
        "openai/gpt-5.2-codex",
      );
    });
  });

  describe("parseActive", () => {
    it("should split on the first slash", () => {
      expect(parseActive("anthropic/claude-opus-4-6")).toEqual({
        provider: "anthropic",
        model: "claude-opus-4-6",
      });
    });

    it("should handle model names containing slashes", () => {
      expect(parseActive("openai/meta-llama/llama-3")).toEqual({
        provider: "openai",
        model: "meta-llama/llama-3",
      });
    });
  });

  describe("toBuildConfig", () => {
    it("should extract the active provider as a BuildConfig", () => {
      const result = toBuildConfig({
        active: "openai/gpt-5.2-codex",
        providers: {
          openai: { apiKey: "sk-test", model: "gpt-5.2-codex" },
          anthropic: { apiKey: "sk-ant", model: "claude-opus-4-6" },
        },
      });
      expect(result).toEqual({
        provider: "openai",
        model: "gpt-5.2-codex",
        apiKey: "sk-test",
      });
    });

    it("should return null when the active provider entry is missing", () => {
      const result = toBuildConfig({
        active: "openai/gpt-5.2-codex",
        providers: {},
      });
      expect(result).toBeNull();
    });
  });

  describe("updateProvider", () => {
    it("should add a new provider and set it active", () => {
      const base = {
        active: "openai/gpt-5.2-codex",
        providers: {
          openai: { apiKey: "sk-test", model: "gpt-5.2-codex" } as const,
        },
      };
      const result = updateProvider(base, "anthropic", "claude-opus-4-6", "sk-ant");
      expect(result.active).toBe("anthropic/claude-opus-4-6");
      expect(result.providers.anthropic).toEqual({
        apiKey: "sk-ant",
        model: "claude-opus-4-6",
      });
      // Existing provider preserved
      expect(result.providers.openai).toEqual(base.providers.openai);
    });

    it("should update an existing provider's model and key", () => {
      const base = {
        active: "openai/gpt-5.2-codex",
        providers: {
          openai: { apiKey: "sk-old", model: "gpt-5.2-codex" } as const,
        },
      };
      const result = updateProvider(base, "openai", "o3", "sk-new");
      expect(result.active).toBe("openai/o3");
      expect(result.providers.openai).toEqual({
        apiKey: "sk-new",
        model: "o3",
      });
    });

    it("should work with an empty base config", () => {
      const base = { active: "", providers: {} };
      const result = updateProvider(base, "openai", "gpt-5.2-codex", "sk-test");
      expect(result.active).toBe("openai/gpt-5.2-codex");
      expect(result.providers.openai).toEqual({
        apiKey: "sk-test",
        model: "gpt-5.2-codex",
      });
    });
  });

  // ── I/O ─────────────────────────────────────────────────

  describe("readConfig", () => {
    it("should return null when config does not exist", async () => {
      const config = await readConfig();
      expect(config).toBeNull();
    });

    it("should read a valid multi-provider config", async () => {
      const configDir = path.join(fakeHome, ".warden");
      await fs.mkdir(configDir, { recursive: true });
      await fs.writeFile(
        path.join(configDir, "config.json"),
        JSON.stringify({
          active: "openai/gpt-4o",
          providers: {
            openai: { apiKey: "sk-test", model: "gpt-4o" },
          },
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

  describe("readMultiConfig", () => {
    it("should return null when config does not exist", async () => {
      const multi = await readMultiConfig();
      expect(multi).toBeNull();
    });

    it("should read a valid multi-provider config", async () => {
      const stored = {
        active: "anthropic/claude-opus-4-6",
        providers: {
          openai: { apiKey: "sk-test", model: "gpt-5.2-codex" },
          anthropic: { apiKey: "sk-ant", model: "claude-opus-4-6" },
        },
      };
      const configDir = path.join(fakeHome, ".warden");
      await fs.mkdir(configDir, { recursive: true });
      await fs.writeFile(
        path.join(configDir, "config.json"),
        JSON.stringify(stored),
      );

      const multi = await readMultiConfig();
      expect(multi).toEqual(stored);
    });

    it("should return null for malformed JSON", async () => {
      const configDir = path.join(fakeHome, ".warden");
      await fs.mkdir(configDir, { recursive: true });
      await fs.writeFile(path.join(configDir, "config.json"), "{bad");

      const multi = await readMultiConfig();
      expect(multi).toBeNull();
    });
  });

  describe("migration", () => {
    it("should silently migrate a legacy config and return the correct BuildConfig", async () => {
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

      // readConfig returns the legacy data as a BuildConfig
      const config = await readConfig();
      expect(config).toEqual({
        provider: "openai",
        model: "gpt-4o",
        apiKey: "sk-test",
      });

      // The file on disk should now be in the new format
      const raw = JSON.parse(
        await fs.readFile(path.join(configDir, "config.json"), "utf-8"),
      );
      expect(raw.active).toBe("openai/gpt-4o");
      expect(raw.providers.openai).toEqual({
        apiKey: "sk-test",
        model: "gpt-4o",
      });
    });

    it("should silently migrate via readMultiConfig", async () => {
      const configDir = path.join(fakeHome, ".warden");
      await fs.mkdir(configDir, { recursive: true });
      await fs.writeFile(
        path.join(configDir, "config.json"),
        JSON.stringify({
          provider: "anthropic",
          model: "claude-opus-4-6",
          apiKey: "sk-ant-test",
        }),
      );

      const multi = await readMultiConfig();
      expect(multi).toEqual({
        active: "anthropic/claude-opus-4-6",
        providers: {
          anthropic: { apiKey: "sk-ant-test", model: "claude-opus-4-6" },
        },
      });
    });
  });

  describe("writeConfig", () => {
    it("should create the config directory and write the file", async () => {
      await writeConfig({
        active: "anthropic/claude-sonnet-4-20250514",
        providers: {
          anthropic: {
            apiKey: "sk-ant-test",
            model: "claude-sonnet-4-20250514",
          },
        },
      });

      const content = await fs.readFile(
        path.join(fakeHome, ".warden", "config.json"),
        "utf-8",
      );
      const parsed = JSON.parse(content);
      expect(parsed.active).toBe("anthropic/claude-sonnet-4-20250514");
      expect(parsed.providers.anthropic.apiKey).toBe("sk-ant-test");
    });

    it("should overwrite an existing config", async () => {
      await writeConfig({
        active: "openai/gpt-4o",
        providers: { openai: { apiKey: "old-key", model: "gpt-4o" } },
      });
      await writeConfig({
        active: "openai/gpt-4o-mini",
        providers: { openai: { apiKey: "new-key", model: "gpt-4o-mini" } },
      });

      const config = await readConfig();
      expect(config?.model).toBe("gpt-4o-mini");
      expect(config?.apiKey).toBe("new-key");
    });
  });
});
