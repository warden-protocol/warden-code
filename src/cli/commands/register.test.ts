import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";
import {
  updateRegistrationFiles,
  setRegistrationActive,
  parseRegistrations,
  validateForRegistration,
} from "./register.js";
import type { AgentProjectConfig } from "../services/agent-config.js";
import type { Erc8004Chain } from "../services/erc8004.js";

const TEST_CHAIN: Erc8004Chain = {
  name: "Base Sepolia",
  chainId: 84532,
  registry: "0x8004A818BFB912233c491871b3d84c89A494BD9e",
  rpcUrl: "https://sepolia.base.org",
  explorerTxUrl: "https://sepolia.basescan.org/tx/",
  testnet: true,
};

describe("updateRegistrationFiles", () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(
      path.join(os.tmpdir(), "warden-register-test-"),
    );
    // Create the directory structure
    await fs.mkdir(path.join(testDir, "public", ".well-known"), {
      recursive: true,
    });
  });

  afterEach(async () => {
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  it("should create registration entries when files do not exist", async () => {
    await updateRegistrationFiles(
      testDir,
      "https://my-agent.example.com",
      42n,
      TEST_CHAIN,
    );

    const result = JSON.parse(
      await fs.readFile(
        path.join(testDir, "public", ".well-known", "agent-registration.json"),
        "utf-8",
      ),
    );

    expect(result.image).toBe("https://my-agent.example.com/icon.png");
    expect(result.registrations).toEqual([
      {
        agentId: 42,
        agentRegistry:
          "eip155:84532:0x8004A818BFB912233c491871b3d84c89A494BD9e",
      },
    ]);
  });

  it("should preserve existing fields and update registration", async () => {
    const existing = {
      type: "https://eips.ethereum.org/EIPS/eip-8004#registration-v1",
      name: "Test Agent",
      description: "A test agent",
      image: "",
      services: [
        { name: "A2A", endpoint: "", version: "0.3.0" },
        { name: "Web", endpoint: "" },
        { name: "OASF", endpoint: "", version: "v0.8.0", skills: ["reasoning_and_problem_solving/inference_and_deduction"] },
      ],
      x402Support: false,
      x402Networks: [],
      active: true,
      registrations: [],
      supportedTrust: ["reputation"],
    };

    await fs.writeFile(
      path.join(testDir, "public", ".well-known", "agent-registration.json"),
      JSON.stringify(existing),
    );

    await updateRegistrationFiles(
      testDir,
      "https://my-agent.example.com",
      7n,
      TEST_CHAIN,
    );

    const result = JSON.parse(
      await fs.readFile(
        path.join(testDir, "public", ".well-known", "agent-registration.json"),
        "utf-8",
      ),
    );

    // Existing fields preserved
    expect(result.type).toBe(
      "https://eips.ethereum.org/EIPS/eip-8004#registration-v1",
    );
    expect(result.name).toBe("Test Agent");
    expect(result.active).toBe(true);
    expect(result.supportedTrust).toEqual(["reputation"]);

    // A2A and OASF endpoints set to agent card
    expect(result.services[0].endpoint).toBe(
      "https://my-agent.example.com/.well-known/agent-card.json",
    );
    expect(result.services[2].endpoint).toBe(
      "https://my-agent.example.com/.well-known/agent-card.json",
    );

    // Web endpoint set to base URL
    expect(result.services[1].endpoint).toBe(
      "https://my-agent.example.com/",
    );

    // OASF skills preserved
    expect(result.services[2].skills).toEqual(
      ["reasoning_and_problem_solving/inference_and_deduction"],
    );

    expect(result.image).toBe("https://my-agent.example.com/icon.png");
    expect(result.registrations).toEqual([
      {
        agentId: 7,
        agentRegistry:
          "eip155:84532:0x8004A818BFB912233c491871b3d84c89A494BD9e",
      },
    ]);
  });

  it("should deduplicate registrations by agentRegistry", async () => {
    const existing = {
      registrations: [
        {
          agentId: 1,
          agentRegistry:
            "eip155:84532:0x8004A818BFB912233c491871b3d84c89A494BD9e",
        },
        {
          agentId: 99,
          agentRegistry: "eip155:1:0x8004A169FB4a3325136EB29fA0ceB6D2e539a432",
        },
      ],
      services: [{ name: "A2A", endpoint: "", version: "0.5.0" }],
    };

    await fs.writeFile(
      path.join(testDir, "public", ".well-known", "agent-registration.json"),
      JSON.stringify(existing),
    );

    await updateRegistrationFiles(
      testDir,
      "https://my-agent.example.com",
      42n,
      TEST_CHAIN,
    );

    const result = JSON.parse(
      await fs.readFile(
        path.join(testDir, "public", ".well-known", "agent-registration.json"),
        "utf-8",
      ),
    );

    // Should have 2 entries: the existing mainnet one + the new testnet one (replaced)
    expect(result.registrations).toHaveLength(2);
    expect(result.registrations).toEqual([
      {
        agentId: 99,
        agentRegistry: "eip155:1:0x8004A169FB4a3325136EB29fA0ceB6D2e539a432",
      },
      {
        agentId: 42,
        agentRegistry:
          "eip155:84532:0x8004A818BFB912233c491871b3d84c89A494BD9e",
      },
    ]);
  });

  it("should handle malformed existing JSON gracefully", async () => {
    await fs.writeFile(
      path.join(testDir, "public", ".well-known", "agent-registration.json"),
      "not valid json {{{",
    );

    await updateRegistrationFiles(
      testDir,
      "https://my-agent.example.com",
      5n,
      TEST_CHAIN,
    );

    const result = JSON.parse(
      await fs.readFile(
        path.join(testDir, "public", ".well-known", "agent-registration.json"),
        "utf-8",
      ),
    );

    expect(result.registrations).toEqual([
      {
        agentId: 5,
        agentRegistry:
          "eip155:84532:0x8004A818BFB912233c491871b3d84c89A494BD9e",
      },
    ]);
  });

  it("should work with a mainnet chain", async () => {
    const mainnetChain: Erc8004Chain = {
      name: "Ethereum",
      chainId: 1,
      registry: "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432",
      rpcUrl: "https://eth.drpc.org",
      explorerTxUrl: "https://etherscan.io/tx/",
      testnet: false,
    };

    await updateRegistrationFiles(
      testDir,
      "https://prod-agent.example.com",
      100n,
      mainnetChain,
    );

    const result = JSON.parse(
      await fs.readFile(
        path.join(testDir, "public", ".well-known", "agent-registration.json"),
        "utf-8",
      ),
    );

    expect(result.registrations).toEqual([
      {
        agentId: 100,
        agentRegistry: "eip155:1:0x8004A169FB4a3325136EB29fA0ceB6D2e539a432",
      },
    ]);
  });
});

describe("setRegistrationActive", () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(
      path.join(os.tmpdir(), "warden-activate-test-"),
    );
    await fs.mkdir(path.join(testDir, "public", ".well-known"), {
      recursive: true,
    });
  });

  afterEach(async () => {
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  it("should set active to false on an active agent", async () => {
    const existing = {
      name: "Test Agent",
      active: true,
      registrations: [{ agentId: 1, agentRegistry: "eip155:84532:0xabc" }],
    };
    await fs.writeFile(
      path.join(testDir, "public", ".well-known", "agent-registration.json"),
      JSON.stringify(existing),
    );

    await setRegistrationActive(testDir, false);

    const result = JSON.parse(
      await fs.readFile(
        path.join(testDir, "public", ".well-known", "agent-registration.json"),
        "utf-8",
      ),
    );
    expect(result.active).toBe(false);
    expect(result.name).toBe("Test Agent");
    expect(result.registrations).toHaveLength(1);
  });

  it("should set active to true on a deactivated agent", async () => {
    const existing = {
      name: "Test Agent",
      active: false,
      registrations: [{ agentId: 1, agentRegistry: "eip155:84532:0xabc" }],
    };
    await fs.writeFile(
      path.join(testDir, "public", ".well-known", "agent-registration.json"),
      JSON.stringify(existing),
    );

    await setRegistrationActive(testDir, true);

    const result = JSON.parse(
      await fs.readFile(
        path.join(testDir, "public", ".well-known", "agent-registration.json"),
        "utf-8",
      ),
    );
    expect(result.active).toBe(true);
  });

  it("should handle missing files gracefully", async () => {
    await setRegistrationActive(testDir, false);

    const result = JSON.parse(
      await fs.readFile(
        path.join(testDir, "public", ".well-known", "agent-registration.json"),
        "utf-8",
      ),
    );
    expect(result.active).toBe(false);
  });
});

describe("parseRegistrations", () => {
  it("should parse valid registration entries", () => {
    const reg = {
      registrations: [
        { agentId: 42, agentRegistry: "eip155:84532:0xabc" },
        { agentId: 99, agentRegistry: "eip155:1:0xdef" },
      ],
    };
    const result = parseRegistrations("", reg);
    expect(result).toHaveLength(2);
    expect(result[0].agentId).toBe(42);
    expect(result[1].agentRegistry).toBe("eip155:1:0xdef");
  });

  it("should filter out invalid entries", () => {
    const reg = {
      registrations: [
        { agentId: 42, agentRegistry: "eip155:84532:0xabc" },
        { agentId: "not-a-number", agentRegistry: "eip155:1:0xdef" },
        { agentId: 7 },
        "invalid",
      ],
    };
    const result = parseRegistrations("", reg);
    expect(result).toHaveLength(1);
    expect(result[0].agentId).toBe(42);
  });

  it("should return empty array when registrations is missing", () => {
    expect(parseRegistrations("", {})).toEqual([]);
  });

  it("should return empty array when registrations is not an array", () => {
    expect(parseRegistrations("", { registrations: "invalid" })).toEqual([]);
  });
});

function makeValidConfig(
  overrides?: Partial<AgentProjectConfig>,
): AgentProjectConfig {
  return {
    server: {
      host: "0.0.0.0",
      port: "3000",
      agentUrl: "https://my-agent.example.com",
    },
    identity: {
      name: "Test Agent",
      description: "A comprehensive test agent for unit testing",
      url: "https://my-agent.example.com",
      version: "1.0.0",
    },
    skills: [
      {
        id: "summarize",
        name: "Summarize",
        description: "Summarize text into key points",
        tags: ["oasf:natural_language/generation/summarization"],
      },
    ],
    payments: {
      enabled: false,
      networks: [],
      x402Support: false,
      x402Networks: [],
    },
    ...overrides,
  };
}

describe("validateForRegistration", () => {
  it("should return no issues for a complete valid config", () => {
    expect(validateForRegistration(makeValidConfig())).toEqual([]);
  });

  it("should return error when name is empty", () => {
    const config = makeValidConfig({
      identity: { name: "", description: "A valid description here", url: "https://example.com", version: "1.0.0" },
    });
    const issues = validateForRegistration(config);
    expect(issues).toContainEqual({
      level: "error",
      message: "Agent name is missing. Run /config to set it.",
    });
  });

  it("should return error when description is empty", () => {
    const config = makeValidConfig({
      identity: { name: "Agent", description: "", url: "https://example.com", version: "1.0.0" },
    });
    const issues = validateForRegistration(config);
    expect(issues).toContainEqual({
      level: "error",
      message: "Agent description is missing. Run /config to set it.",
    });
  });

  it("should return error when URL is empty", () => {
    const config = makeValidConfig({
      identity: { name: "Agent", description: "A valid description here", url: "", version: "1.0.0" },
    });
    const issues = validateForRegistration(config);
    expect(issues).toContainEqual({
      level: "error",
      message: "Agent URL is still set to localhost. Run /config to set a production URL.",
    });
  });

  it("should return error when URL is localhost", () => {
    const config = makeValidConfig({
      identity: { name: "Agent", description: "A valid description here", url: "http://localhost:3000", version: "1.0.0" },
    });
    const issues = validateForRegistration(config);
    expect(issues).toContainEqual({
      level: "error",
      message: "Agent URL is still set to localhost. Run /config to set a production URL.",
    });
  });

  it("should return error for localhost without port", () => {
    const config = makeValidConfig({
      identity: { name: "Agent", description: "A valid description here", url: "http://localhost", version: "1.0.0" },
    });
    const issues = validateForRegistration(config);
    expect(issues).toContainEqual({
      level: "error",
      message: "Agent URL is still set to localhost. Run /config to set a production URL.",
    });
  });

  it("should return warning when skills array is empty", () => {
    const config = makeValidConfig({ skills: [] });
    const issues = validateForRegistration(config);
    expect(issues).toContainEqual({
      level: "warning",
      message: "No skills defined. Agents without skills are harder to discover.",
    });
  });

  it("should return warning when a skill has no name", () => {
    const config = makeValidConfig({
      skills: [{ id: "test-skill", name: "", description: "Does things", tags: [] }],
    });
    const issues = validateForRegistration(config);
    expect(issues).toContainEqual({
      level: "warning",
      message: 'Skill "test-skill" has no name.',
    });
  });

  it("should return warning when a skill has no description", () => {
    const config = makeValidConfig({
      skills: [{ id: "test-skill", name: "Test", description: "", tags: [] }],
    });
    const issues = validateForRegistration(config);
    expect(issues).toContainEqual({
      level: "warning",
      message: 'Skill "test-skill" has no description.',
    });
  });

  it("should return warning when description is very short", () => {
    const config = makeValidConfig({
      identity: { name: "Agent", description: "Short", url: "https://example.com", version: "1.0.0" },
    });
    const issues = validateForRegistration(config);
    expect(issues).toContainEqual({
      level: "warning",
      message: "Agent description is very short. A detailed description improves discoverability.",
    });
  });

  it("should return multiple issues simultaneously", () => {
    const config = makeValidConfig({
      identity: { name: "", description: "", url: "", version: "1.0.0" },
      skills: [],
    });
    const issues = validateForRegistration(config);
    const errors = issues.filter((i) => i.level === "error");
    const warnings = issues.filter((i) => i.level === "warning");
    expect(errors.length).toBeGreaterThanOrEqual(3);
    expect(warnings.length).toBeGreaterThanOrEqual(1);
  });

  it("should not flag a production URL as localhost", () => {
    const config = makeValidConfig({
      identity: { name: "Agent", description: "A valid description here", url: "https://my-agent.fly.dev", version: "1.0.0" },
    });
    const issues = validateForRegistration(config);
    const urlErrors = issues.filter((i) => i.message.includes("localhost"));
    expect(urlErrors).toHaveLength(0);
  });
});
