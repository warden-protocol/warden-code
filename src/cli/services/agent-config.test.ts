import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";
import {
  parseEnv,
  serializeEnv,
  readProjectConfig,
  writeServerConfig,
  writeIdentityConfig,
  writeSkillsConfig,
  writePaymentConfig,
} from "./agent-config.js";

describe("parseEnv", () => {
  it("should parse simple KEY=VALUE pairs", () => {
    const env = parseEnv("HOST=localhost\nPORT=3000\n");
    expect(env.get("HOST")).toBe("localhost");
    expect(env.get("PORT")).toBe("3000");
  });

  it("should skip blank lines", () => {
    const env = parseEnv("HOST=localhost\n\n\nPORT=3000\n");
    expect(env.size).toBe(2);
  });

  it("should skip comment lines", () => {
    const env = parseEnv("# this is a comment\nHOST=localhost\n");
    expect(env.size).toBe(1);
    expect(env.get("HOST")).toBe("localhost");
  });

  it("should handle values containing =", () => {
    const env = parseEnv("URL=http://example.com?foo=bar\n");
    expect(env.get("URL")).toBe("http://example.com?foo=bar");
  });

  it("should handle empty values", () => {
    const env = parseEnv("EMPTY=\n");
    expect(env.get("EMPTY")).toBe("");
  });

  it("should trim keys and values", () => {
    const env = parseEnv("  HOST  =  localhost  \n");
    expect(env.get("HOST")).toBe("localhost");
  });

  it("should return empty map for empty content", () => {
    expect(parseEnv("").size).toBe(0);
  });

  it("should skip lines without =", () => {
    const env = parseEnv("not_a_pair\nHOST=localhost\n");
    expect(env.size).toBe(1);
  });
});

describe("serializeEnv", () => {
  it("should update existing keys", () => {
    const original = "HOST=localhost\nPORT=3000\n";
    const updates = new Map([["PORT", "4000"]]);
    const result = serializeEnv(original, updates);
    expect(result).toContain("PORT=4000");
    expect(result).toContain("HOST=localhost");
  });

  it("should append new keys", () => {
    const original = "HOST=localhost\n";
    const updates = new Map([["PORT", "3000"]]);
    const result = serializeEnv(original, updates);
    expect(result).toContain("HOST=localhost");
    expect(result).toContain("PORT=3000");
  });

  it("should remove specified keys", () => {
    const original = "HOST=localhost\nPORT=3000\nMODE=dev\n";
    const updates = new Map<string, string>();
    const removals = new Set(["PORT"]);
    const result = serializeEnv(original, updates, removals);
    expect(result).toContain("HOST=localhost");
    expect(result).not.toContain("PORT");
    expect(result).toContain("MODE=dev");
  });

  it("should preserve comment lines", () => {
    const original = "# Server config\nHOST=localhost\n";
    const updates = new Map([["HOST", "0.0.0.0"]]);
    const result = serializeEnv(original, updates);
    expect(result).toContain("# Server config");
    expect(result).toContain("HOST=0.0.0.0");
  });

  it("should preserve blank lines", () => {
    const original = "HOST=localhost\n\nPORT=3000\n";
    const updates = new Map<string, string>();
    const lines = serializeEnv(original, updates).split("\n");
    expect(lines[1]).toBe("");
  });

  it("should handle empty original", () => {
    const updates = new Map([["HOST", "localhost"]]);
    const result = serializeEnv("", updates);
    expect(result).toContain("HOST=localhost");
  });

  it("should handle update and removal for the same key (removal wins)", () => {
    const original = "HOST=localhost\nPORT=3000\n";
    const updates = new Map([["PORT", "9999"]]);
    const removals = new Set(["PORT"]);
    const result = serializeEnv(original, updates, removals);
    expect(result).not.toContain("PORT");
  });
});

describe("readProjectConfig", () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(
      path.join(os.tmpdir(), "warden-agent-config-test-"),
    );
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true }).catch(() => {});
  });

  async function setupProject(opts?: {
    env?: string;
    card?: Record<string, unknown>;
    reg?: Record<string, unknown>;
  }): Promise<void> {
    // Create required directory structure
    await fs.mkdir(path.join(testDir, "src"), { recursive: true });
    await fs.writeFile(path.join(testDir, "src", "agent.ts"), "");
    await fs.mkdir(
      path.join(testDir, "public", ".well-known"),
      { recursive: true },
    );

    if (opts?.env !== undefined) {
      await fs.writeFile(path.join(testDir, ".env"), opts.env);
    }

    if (opts?.card) {
      await fs.writeFile(
        path.join(testDir, "public", ".well-known", "agent-card.json"),
        JSON.stringify(opts.card),
      );
    }

    if (opts?.reg) {
      await fs.writeFile(
        path.join(testDir, "public", ".well-known", "agent-registration.json"),
        JSON.stringify(opts.reg),
      );
    }
  }

  it("should return null when agent-card.json is missing", async () => {
    await setupProject({ env: "HOST=localhost\n" });
    expect(await readProjectConfig(testDir)).toBeNull();
  });

  it("should return null when agent-card.json is malformed", async () => {
    await setupProject();
    await fs.writeFile(
      path.join(testDir, "public", ".well-known", "agent-card.json"),
      "not valid json",
    );
    expect(await readProjectConfig(testDir)).toBeNull();
  });

  it("should read a complete project config", async () => {
    await setupProject({
      env: "HOST=0.0.0.0\nPORT=4000\nAGENT_URL=https://prod.example.com\nOPENAI_API_KEY=sk-test123\nOPENAI_MODEL=gpt-4o\n",
      card: {
        name: "Test Agent",
        description: "A test agent",
        url: "https://prod.example.com",
        version: "1.0.0",
      },
      reg: {
        name: "Test Agent",
        description: "A test agent",
        x402Support: false,
        x402Networks: [],
      },
    });

    const config = await readProjectConfig(testDir);
    expect(config).not.toBeNull();
    expect(config!.server.host).toBe("0.0.0.0");
    expect(config!.server.port).toBe("4000");
    expect(config!.server.agentUrl).toBe("https://prod.example.com");
    expect(config!.server.openaiApiKey).toBe("sk-test123");
    expect(config!.server.openaiModel).toBe("gpt-4o");
    expect(config!.identity.name).toBe("Test Agent");
    expect(config!.identity.description).toBe("A test agent");
    expect(config!.identity.url).toBe("https://prod.example.com");
    expect(config!.identity.version).toBe("1.0.0");
    expect(config!.payments.enabled).toBe(false);
    expect(config!.payments.networks).toHaveLength(0);
  });

  it("should detect payment networks from .env", async () => {
    await setupProject({
      env: [
        "HOST=localhost",
        "PORT=3000",
        "AGENT_URL=http://localhost:3000",
        "X402_FACILITATOR_URL=https://x402.org/facilitator",
        "X402_BASE_SEPOLIA_PAY_TO=0x1234567890abcdef1234567890abcdef12345678",
        "X402_BASE_SEPOLIA_PRICE=0.05",
        "X402_BASE_SEPOLIA_NETWORK=eip155:84532",
      ].join("\n"),
      card: { name: "Pay Agent", description: "Paid", url: "", version: "0.1.0" },
      reg: { x402Support: true, x402Networks: ["evm"] },
    });

    const config = await readProjectConfig(testDir);
    expect(config!.payments.enabled).toBe(true);
    expect(config!.payments.facilitatorUrl).toBe("https://x402.org/facilitator");
    expect(config!.payments.networks).toHaveLength(1);
    expect(config!.payments.networks[0]!.prefix).toBe("X402_BASE_SEPOLIA");
    expect(config!.payments.networks[0]!.payTo).toBe(
      "0x1234567890abcdef1234567890abcdef12345678",
    );
    expect(config!.payments.networks[0]!.price).toBe("0.05");
  });

  it("should read skills from agent-card.json", async () => {
    await setupProject({
      env: "HOST=localhost\n",
      card: {
        name: "Skilled Agent",
        description: "Has skills",
        url: "",
        version: "0.1.0",
        skills: [
          {
            id: "summarize",
            name: "Summarize",
            description: "Summarize text",
            tags: ["oasf:natural_language/generation/summarization"],
          },
          {
            id: "translate",
            name: "Translate",
            description: "Translate text between languages",
            tags: [],
          },
        ],
      },
    });

    const config = await readProjectConfig(testDir);
    expect(config!.skills).toHaveLength(2);
    expect(config!.skills[0]!.id).toBe("summarize");
    expect(config!.skills[0]!.name).toBe("Summarize");
    expect(config!.skills[0]!.tags).toEqual([
      "oasf:natural_language/generation/summarization",
    ]);
    expect(config!.skills[1]!.id).toBe("translate");
  });

  it("should return empty skills array when none defined", async () => {
    await setupProject({
      env: "HOST=localhost\n",
      card: { name: "No Skills", description: "", url: "", version: "0.1.0" },
    });

    const config = await readProjectConfig(testDir);
    expect(config!.skills).toEqual([]);
  });

  it("should use defaults when .env is missing", async () => {
    await setupProject({
      card: { name: "Minimal", description: "Minimal agent", url: "", version: "0.1.0" },
    });

    const config = await readProjectConfig(testDir);
    expect(config!.server.host).toBe("localhost");
    expect(config!.server.port).toBe("3000");
    expect(config!.server.agentUrl).toBe("http://localhost:3000");
    expect(config!.server.openaiApiKey).toBeUndefined();
  });
});

describe("writeServerConfig", () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(
      path.join(os.tmpdir(), "warden-write-server-test-"),
    );
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true }).catch(() => {});
  });

  it("should update existing .env values", async () => {
    await fs.writeFile(
      path.join(testDir, ".env"),
      "HOST=localhost\nPORT=3000\nAGENT_URL=http://localhost:3000\n",
    );

    await writeServerConfig(testDir, {
      host: "0.0.0.0",
      port: "4000",
      agentUrl: "https://prod.example.com",
    });

    const content = await fs.readFile(path.join(testDir, ".env"), "utf-8");
    expect(content).toContain("HOST=0.0.0.0");
    expect(content).toContain("PORT=4000");
    expect(content).toContain("AGENT_URL=https://prod.example.com");
  });

  it("should create .env if it does not exist", async () => {
    await writeServerConfig(testDir, {
      host: "localhost",
      port: "3000",
      agentUrl: "http://localhost:3000",
    });

    const content = await fs.readFile(path.join(testDir, ".env"), "utf-8");
    expect(content).toContain("HOST=localhost");
    expect(content).toContain("PORT=3000");
  });

  it("should include OpenAI keys when present", async () => {
    await fs.writeFile(path.join(testDir, ".env"), "HOST=localhost\n");

    await writeServerConfig(testDir, {
      host: "localhost",
      port: "3000",
      agentUrl: "http://localhost:3000",
      openaiApiKey: "sk-new-key",
      openaiModel: "gpt-4o-mini",
    });

    const content = await fs.readFile(path.join(testDir, ".env"), "utf-8");
    expect(content).toContain("OPENAI_API_KEY=sk-new-key");
    expect(content).toContain("OPENAI_MODEL=gpt-4o-mini");
  });
});

describe("writeIdentityConfig", () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(
      path.join(os.tmpdir(), "warden-write-identity-test-"),
    );
    await fs.mkdir(path.join(testDir, "public", ".well-known"), {
      recursive: true,
    });
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true }).catch(() => {});
  });

  it("should update agent-card.json", async () => {
    await fs.writeFile(
      path.join(testDir, "public", ".well-known", "agent-card.json"),
      JSON.stringify({ name: "Old", description: "Old desc", url: "", version: "0.1.0" }),
    );

    await writeIdentityConfig(testDir, {
      name: "New Agent",
      description: "New description",
      url: "https://example.com",
      version: "1.0.0",
    });

    const card = JSON.parse(
      await fs.readFile(
        path.join(testDir, "public", ".well-known", "agent-card.json"),
        "utf-8",
      ),
    );
    expect(card.name).toBe("New Agent");
    expect(card.description).toBe("New description");
    expect(card.url).toBe("https://example.com");
    expect(card.version).toBe("1.0.0");
  });

  it("should update agent-registration.json", async () => {
    await fs.writeFile(
      path.join(testDir, "public", ".well-known", "agent-registration.json"),
      JSON.stringify({ name: "Old", description: "Old" }),
    );

    await writeIdentityConfig(testDir, {
      name: "Updated",
      description: "Updated desc",
      url: "",
      version: "0.1.0",
    });

    const reg = JSON.parse(
      await fs.readFile(
        path.join(testDir, "public", ".well-known", "agent-registration.json"),
        "utf-8",
      ),
    );
    expect(reg.name).toBe("Updated");
    expect(reg.description).toBe("Updated desc");
  });

  it("should preserve existing fields in agent-card.json", async () => {
    await fs.writeFile(
      path.join(testDir, "public", ".well-known", "agent-card.json"),
      JSON.stringify({
        name: "Old",
        description: "Old",
        url: "",
        version: "0.1.0",
        capabilities: { streaming: true },
        skills: [{ id: "test" }],
      }),
    );

    await writeIdentityConfig(testDir, {
      name: "New",
      description: "New",
      url: "http://new.com",
      version: "2.0.0",
    });

    const card = JSON.parse(
      await fs.readFile(
        path.join(testDir, "public", ".well-known", "agent-card.json"),
        "utf-8",
      ),
    );
    expect(card.name).toBe("New");
    expect(card.capabilities).toEqual({ streaming: true });
    expect(card.skills).toEqual([{ id: "test" }]);
  });
});

describe("writeSkillsConfig", () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(
      path.join(os.tmpdir(), "warden-write-skills-test-"),
    );
    await fs.mkdir(path.join(testDir, "public", ".well-known"), {
      recursive: true,
    });
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true }).catch(() => {});
  });

  it("should write skills to agent-card.json", async () => {
    await fs.writeFile(
      path.join(testDir, "public", ".well-known", "agent-card.json"),
      JSON.stringify({ name: "Agent", skills: [] }),
    );

    await writeSkillsConfig(testDir, [
      { id: "chat", name: "Chat", description: "General chat", tags: [] },
    ]);

    const card = JSON.parse(
      await fs.readFile(
        path.join(testDir, "public", ".well-known", "agent-card.json"),
        "utf-8",
      ),
    );
    expect(card.skills).toHaveLength(1);
    expect(card.skills[0].id).toBe("chat");
    expect(card.skills[0].name).toBe("Chat");
  });

  it("should preserve other fields in agent-card.json", async () => {
    await fs.writeFile(
      path.join(testDir, "public", ".well-known", "agent-card.json"),
      JSON.stringify({
        name: "Agent",
        description: "Test",
        capabilities: { streaming: true },
        skills: [{ id: "old" }],
      }),
    );

    await writeSkillsConfig(testDir, [
      { id: "new", name: "New Skill", description: "Fresh", tags: ["oasf:test"] },
    ]);

    const card = JSON.parse(
      await fs.readFile(
        path.join(testDir, "public", ".well-known", "agent-card.json"),
        "utf-8",
      ),
    );
    expect(card.name).toBe("Agent");
    expect(card.capabilities).toEqual({ streaming: true });
    expect(card.skills).toHaveLength(1);
    expect(card.skills[0].id).toBe("new");
    expect(card.skills[0].tags).toEqual(["oasf:test"]);
  });

  it("should handle writing empty skills array", async () => {
    await fs.writeFile(
      path.join(testDir, "public", ".well-known", "agent-card.json"),
      JSON.stringify({ name: "Agent", skills: [{ id: "old" }] }),
    );

    await writeSkillsConfig(testDir, []);

    const card = JSON.parse(
      await fs.readFile(
        path.join(testDir, "public", ".well-known", "agent-card.json"),
        "utf-8",
      ),
    );
    expect(card.skills).toEqual([]);
  });
});

describe("writePaymentConfig", () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(
      path.join(os.tmpdir(), "warden-write-payment-test-"),
    );
    await fs.mkdir(path.join(testDir, "public", ".well-known"), {
      recursive: true,
    });
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true }).catch(() => {});
  });

  it("should add payment network to .env", async () => {
    await fs.writeFile(
      path.join(testDir, ".env"),
      "HOST=localhost\nPORT=3000\n",
    );
    await fs.writeFile(
      path.join(testDir, "public", ".well-known", "agent-registration.json"),
      JSON.stringify({ x402Support: false, x402Networks: [] }),
    );

    await writePaymentConfig(testDir, {
      enabled: true,
      facilitatorUrl: "https://x402.org/facilitator",
      networks: [
        {
          prefix: "X402_BASE_SEPOLIA",
          network: "eip155:84532",
          payTo: "0xabc",
          price: "0.01",
        },
      ],
      x402Support: true,
      x402Networks: ["evm"],
    });

    const env = await fs.readFile(path.join(testDir, ".env"), "utf-8");
    expect(env).toContain("X402_FACILITATOR_URL=https://x402.org/facilitator");
    expect(env).toContain("X402_BASE_SEPOLIA_PAY_TO=0xabc");
    expect(env).toContain("X402_BASE_SEPOLIA_PRICE=0.01");
    expect(env).toContain("X402_BASE_SEPOLIA_NETWORK=eip155:84532");
  });

  it("should remove payment network from .env", async () => {
    await fs.writeFile(
      path.join(testDir, ".env"),
      [
        "HOST=localhost",
        "X402_FACILITATOR_URL=https://x402.org/facilitator",
        "X402_BASE_SEPOLIA_PAY_TO=0xabc",
        "X402_BASE_SEPOLIA_PRICE=0.01",
        "X402_BASE_SEPOLIA_NETWORK=eip155:84532",
      ].join("\n"),
    );
    await fs.writeFile(
      path.join(testDir, "public", ".well-known", "agent-registration.json"),
      JSON.stringify({ x402Support: true, x402Networks: ["evm"] }),
    );

    await writePaymentConfig(testDir, {
      enabled: false,
      networks: [],
      x402Support: false,
      x402Networks: [],
    });

    const env = await fs.readFile(path.join(testDir, ".env"), "utf-8");
    expect(env).toContain("HOST=localhost");
    expect(env).not.toContain("X402_FACILITATOR_URL");
    expect(env).not.toContain("X402_BASE_SEPOLIA_PAY_TO");
    expect(env).not.toContain("X402_BASE_SEPOLIA_PRICE");
    expect(env).not.toContain("X402_BASE_SEPOLIA_NETWORK");
  });

  it("should update registration JSON file", async () => {
    await fs.writeFile(path.join(testDir, ".env"), "");
    await fs.writeFile(
      path.join(testDir, "public", ".well-known", "agent-registration.json"),
      JSON.stringify({ x402Support: false, x402Networks: [] }),
    );

    await writePaymentConfig(testDir, {
      enabled: true,
      facilitatorUrl: "https://x402.org/facilitator",
      networks: [
        {
          prefix: "X402_BASE_SEPOLIA",
          network: "eip155:84532",
          payTo: "0xabc",
          price: "0.01",
        },
      ],
      x402Support: true,
      x402Networks: ["evm"],
    });

    const reg = JSON.parse(
      await fs.readFile(
        path.join(testDir, "public", ".well-known", "agent-registration.json"),
        "utf-8",
      ),
    );
    expect(reg.x402Support).toBe(true);
    expect(reg.x402Networks).toEqual(["evm"]);
  });
});
