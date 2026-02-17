import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";
import { processTemplate } from "./scaffolder.js";
import type { AgentConfig } from "../types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const templatesDir = join(__dirname, "..", "..", "templates");

function createMockConfig(overrides: Partial<AgentConfig> = {}): AgentConfig {
  return {
    name: "Test Agent",
    packageName: "test-agent",
    description: "A test agent",
    template: "echo",
    capabilities: {
      streaming: false,
      multiTurn: true,
    },
    skills: [],
    ...overrides,
  };
}

describe("processTemplate", () => {
  describe("placeholder replacement", () => {
    it("should replace {{name}} placeholder", () => {
      const content = 'const name = "{{name}}";';
      const config = createMockConfig({ name: "my-cool-agent" });

      const result = processTemplate(content, config);

      expect(result).toBe('const name = "my-cool-agent";');
    });

    it("should replace multiple {{name}} placeholders", () => {
      const content = "Name: {{name}}, Agent: {{name}}";
      const config = createMockConfig({ name: "agent-x" });

      const result = processTemplate(content, config);

      expect(result).toBe("Name: agent-x, Agent: agent-x");
    });

    it("should replace {{description}} placeholder", () => {
      const content = 'description: "{{description}}"';
      const config = createMockConfig({ description: "An awesome agent" });

      const result = processTemplate(content, config);

      expect(result).toBe('description: "An awesome agent"');
    });

    it("should replace multiple {{description}} placeholders", () => {
      const content = "{{description}} - {{description}}";
      const config = createMockConfig({ description: "Test" });

      const result = processTemplate(content, config);

      expect(result).toBe("Test - Test");
    });
  });

  describe("skills replacement", () => {
    it("should replace {{skills}} with empty string for no skills", () => {
      const content = "skills: [{{skills}}]";
      const config = createMockConfig({ skills: [] });

      const result = processTemplate(content, config);

      expect(result).toBe("skills: []");
    });

    it("should replace {{skills}} with single skill", () => {
      const content = "skills: [{{skills}}]";
      const config = createMockConfig({
        skills: [
          {
            id: "skill-1",
            name: "Test Skill",
            description: "A test skill",
          },
        ],
      });

      const result = processTemplate(content, config);

      expect(result).toContain('id: "skill-1"');
      expect(result).toContain('name: "Test Skill"');
      expect(result).toContain('description: "A test skill"');
      expect(result).toContain("tags: []");
    });

    it("should replace {{skills}} with multiple skills", () => {
      const content = "skills: [{{skills}}]";
      const config = createMockConfig({
        skills: [
          {
            id: "skill-1",
            name: "Skill One",
            description: "First skill",
          },
          {
            id: "skill-2",
            name: "Skill Two",
            description: "Second skill",
          },
        ],
      });

      const result = processTemplate(content, config);

      expect(result).toContain('id: "skill-1"');
      expect(result).toContain('id: "skill-2"');
      expect(result).toContain('name: "Skill One"');
      expect(result).toContain('name: "Skill Two"');
    });
  });

  describe("skills_json replacement", () => {
    it("should replace {{skills_json}} with empty string for no skills", () => {
      const content = '"skills": [{{skills_json}}]';
      const config = createMockConfig({ skills: [] });

      const result = processTemplate(content, config);

      expect(result).toBe('"skills": []');
    });

    it("should replace {{skills_json}} with valid JSON for a skill", () => {
      const content = "[{{skills_json}}]";
      const config = createMockConfig({
        skills: [
          {
            id: "calc",
            name: "Calculator",
            description: "Does math",
          },
        ],
      });

      const result = processTemplate(content, config);
      const parsed = JSON.parse(result);

      expect(parsed).toHaveLength(1);
      expect(parsed[0]).toEqual({
        id: "calc",
        name: "Calculator",
        description: "Does math",
        tags: [],
      });
    });

    it("should produce valid JSON for multiple skills", () => {
      const content = "[{{skills_json}}]";
      const config = createMockConfig({
        skills: [
          { id: "a", name: "A", description: "First" },
          { id: "b", name: "B", description: "Second" },
        ],
      });

      const result = processTemplate(content, config);
      const parsed = JSON.parse(result);

      expect(parsed).toHaveLength(2);
      expect(parsed[0].id).toBe("a");
      expect(parsed[1].id).toBe("b");
    });
  });

  describe("capabilities replacement", () => {
    it("should replace {{capabilities_streaming}} with true", () => {
      const content = "streaming: {{capabilities_streaming}}";
      const config = createMockConfig({
        capabilities: { streaming: true, multiTurn: false },
      });

      const result = processTemplate(content, config);

      expect(result).toBe("streaming: true");
    });

    it("should replace {{capabilities_streaming}} with false", () => {
      const content = "streaming: {{capabilities_streaming}}";
      const config = createMockConfig({
        capabilities: { streaming: false, multiTurn: true },
      });

      const result = processTemplate(content, config);

      expect(result).toBe("streaming: false");
    });

    it("should replace {{capabilities_multiturn}} with true", () => {
      const content = "multiTurn: {{capabilities_multiturn}}";
      const config = createMockConfig({
        capabilities: { streaming: false, multiTurn: true },
      });

      const result = processTemplate(content, config);

      expect(result).toBe("multiTurn: true");
    });

    it("should replace {{capabilities_multiturn}} with false", () => {
      const content = "multiTurn: {{capabilities_multiturn}}";
      const config = createMockConfig({
        capabilities: { streaming: true, multiTurn: false },
      });

      const result = processTemplate(content, config);

      expect(result).toBe("multiTurn: false");
    });
  });

  describe("model startup log replacement", () => {
    it("should replace {{model_startup_log}} with OpenAI log for openai template", () => {
      const content = "{{model_startup_log}}";
      const config = createMockConfig({ template: "openai" });

      const result = processTemplate(content, config);

      expect(result).toContain("OPENAI_API_KEY");
      expect(result).toContain("OPENAI_MODEL");
      expect(result).toContain("gpt-4o-mini");
    });

    it("should replace {{model_startup_log}} with empty string for echo template", () => {
      const content = "before\n{{model_startup_log}}\nafter";
      const config = createMockConfig({ template: "echo" });

      const result = processTemplate(content, config);

      expect(result).toBe("before\n\nafter");
    });
  });

  describe("x402 replacement", () => {
    it("should replace {{x402_imports}} with empty string when x402 is not configured", () => {
      const content = "{{x402_imports}}";
      const config = createMockConfig();

      const result = processTemplate(content, config);

      expect(result).toBe("");
    });

    it("should replace {{x402_imports}} with express and x402 imports when x402 is configured", () => {
      const content = "{{x402_imports}}";
      const config = createMockConfig({
        x402: { price: "$0.01", network: "eip155:84532" },
      });

      const result = processTemplate(content, config);

      expect(result).toContain('import express from "express"');
      expect(result).toContain("@x402/express");
      expect(result).toContain("@x402/core/server");
      expect(result).toContain("@x402/evm/exact/server");
    });

    it("should replace {{x402_listen}} with standard server.listen when x402 is not configured", () => {
      const content = "{{x402_listen}}";
      const config = createMockConfig();

      const result = processTemplate(content, config);

      expect(result).toContain("server.listen(PORT)");
      expect(result).not.toContain("express");
      expect(result).not.toContain("paymentMiddleware");
    });

    it("should replace {{x402_listen}} with Express wrapper when x402 is configured", () => {
      const content = "{{x402_listen}}";
      const config = createMockConfig({
        x402: { price: "$0.05", network: "eip155:8453" },
      });

      const result = processTemplate(content, config);

      expect(result).toContain("paymentMiddleware");
      expect(result).toContain("x402ResourceServer");
      expect(result).toContain("app.listen(PORT");
      expect(result).toContain("$0.05");
      expect(result).toContain("eip155:8453");
    });

    it("should replace {{x402_dependencies}} with empty string when x402 is not configured", () => {
      const content = "deps{{x402_dependencies}}";
      const config = createMockConfig();

      const result = processTemplate(content, config);

      expect(result).toBe("deps");
    });

    it("should replace {{x402_dependencies}} with express and x402 packages when configured", () => {
      const content = "{{x402_dependencies}}";
      const config = createMockConfig({
        x402: { price: "$0.01", network: "eip155:84532" },
      });

      const result = processTemplate(content, config);

      expect(result).toContain('"express"');
      expect(result).toContain('"@x402/express"');
      expect(result).toContain('"@x402/core"');
      expect(result).toContain('"@x402/evm"');
    });

    it("should replace {{x402_dev_dependencies}} with @types/express when configured", () => {
      const content = "{{x402_dev_dependencies}}";
      const config = createMockConfig({
        x402: { price: "$0.01", network: "eip155:84532" },
      });

      const result = processTemplate(content, config);

      expect(result).toContain('"@types/express"');
    });

    it("should replace {{x402_env_config}} with empty string when x402 is not configured", () => {
      const content = "{{x402_env_config}}";
      const config = createMockConfig();

      const result = processTemplate(content, config);

      expect(result).toBe("");
    });

    it("should replace {{x402_env_config}} with env vars when configured", () => {
      const content = "{{x402_env_config}}";
      const config = createMockConfig({
        x402: { price: "$0.01", network: "eip155:84532" },
      });

      const result = processTemplate(content, config);

      expect(result).toContain("X402_PAY_TO_ADDRESS");
      expect(result).toContain("X402_PRICE=$0.01");
      expect(result).toContain("X402_NETWORK=eip155:84532");
      expect(result).toContain("X402_FACILITATOR_URL");
    });

    it("should replace {{x402_env_setup}} with empty string when x402 is not configured", () => {
      const content = "{{x402_env_setup}}";
      const config = createMockConfig();

      const result = processTemplate(content, config);

      expect(result).toBe("");
    });

    it("should replace {{x402_env_setup}} with README section when configured", () => {
      const content = "{{x402_env_setup}}";
      const config = createMockConfig({
        x402: { price: "$0.01", network: "eip155:84532" },
      });

      const result = processTemplate(content, config);

      expect(result).toContain("x402");
      expect(result).toContain("X402_PAY_TO_ADDRESS");
      expect(result).toContain("USDC");
    });

    it("should resolve {{name}} inside {{x402_listen}} content", () => {
      const content = "{{x402_listen}}";
      const config = createMockConfig({
        name: "Payment Agent",
        x402: { price: "$0.01", network: "eip155:84532" },
      });

      const result = processTemplate(content, config);

      expect(result).toContain("Payment Agent");
      expect(result).not.toContain("{{name}}");
    });

    it("should resolve {{description}} inside {{x402_listen}} content", () => {
      const content = "{{x402_listen}}";
      const config = createMockConfig({
        description: "A paid agent",
        x402: { price: "$0.01", network: "eip155:84532" },
      });

      const result = processTemplate(content, config);

      expect(result).toContain("A paid agent");
      expect(result).not.toContain("{{description}}");
    });
  });

  describe("combined replacements", () => {
    it("should replace all placeholders in a template", () => {
      const content = `
const agent = {
  name: "{{name}}",
  description: "{{description}}",
  skills: [{{skills}}],
};
`;
      const config = createMockConfig({
        name: "full-agent",
        description: "A fully configured agent",
        skills: [
          {
            id: "calc",
            name: "Calculator",
            description: "Performs calculations",
          },
        ],
      });

      const result = processTemplate(content, config);

      expect(result).toContain('name: "full-agent"');
      expect(result).toContain('description: "A fully configured agent"');
      expect(result).toContain('id: "calc"');
      expect(result).toContain('name: "Calculator"');
    });

    it("should preserve non-placeholder content", () => {
      const content = `
import { something } from "somewhere";

export const config = {
  name: "{{name}}",
  version: "1.0.0",
};
`;
      const config = createMockConfig({ name: "test" });

      const result = processTemplate(content, config);

      expect(result).toContain('import { something } from "somewhere";');
      expect(result).toContain('version: "1.0.0"');
    });
  });
});

describe("template integration (actual template files)", () => {
  function readTemplate(name: string): string {
    return readFileSync(join(templatesDir, name), "utf-8");
  }

  const echoConfig = createMockConfig({
    name: "Echo Bot",
    packageName: "echo-bot",
    description: "Echoes back messages",
    template: "echo",
  });

  const x402Config = createMockConfig({
    name: "Paid Agent",
    packageName: "paid-agent",
    description: "A premium agent",
    template: "openai",
    x402: { price: "$0.05", network: "eip155:84532" },
  });

  describe("server.ts.template", () => {
    const template = readTemplate("server.ts.template");

    it("should produce valid output without x402", () => {
      const result = processTemplate(template, echoConfig);

      expect(result).toContain('import "dotenv/config"');
      expect(result).toContain("AgentServer");
      expect(result).toContain("server.listen(PORT)");
      expect(result).not.toContain("{{");
      expect(result).not.toContain("express");
      expect(result).not.toContain("paymentMiddleware");
    });

    it("should produce Express wrapper with x402", () => {
      const result = processTemplate(template, x402Config);

      expect(result).toContain('import "dotenv/config"');
      expect(result).toContain("AgentServer");
      expect(result).toContain('import express from "express"');
      expect(result).toContain("paymentMiddleware");
      expect(result).toContain("x402ResourceServer");
      expect(result).toContain("app.listen(PORT");
      expect(result).toContain("$0.05");
      expect(result).toContain("eip155:84532");
      expect(result).not.toContain("server.listen(PORT)");
      expect(result).not.toContain("{{");
    });

    it("should resolve nested placeholders inside x402 block", () => {
      const result = processTemplate(template, x402Config);

      expect(result).toContain("Paid Agent");
      expect(result).toContain("A premium agent");
      expect(result).toContain("OPENAI_API_KEY");
      expect(result).not.toContain("{{name}}");
      expect(result).not.toContain("{{description}}");
      expect(result).not.toContain("{{model_startup_log}}");
    });

    it("should include CORS headers with x402", () => {
      const result = processTemplate(template, x402Config);

      expect(result).toContain("Access-Control-Allow-Origin");
      expect(result).toContain("PAYMENT-SIGNATURE");
      expect(result).toContain("PAYMENT-REQUIRED");
    });
  });

  describe("package.json.template", () => {
    const template = readTemplate("package.json.template");

    it("should produce valid JSON without x402", () => {
      const result = processTemplate(template, echoConfig);
      const parsed = JSON.parse(result);

      expect(parsed.name).toBe("echo-bot");
      expect(parsed.dependencies).toHaveProperty("@wardenprotocol/agent-kit");
      expect(parsed.dependencies).toHaveProperty("dotenv");
      expect(parsed.dependencies).not.toHaveProperty("express");
      expect(parsed.dependencies).not.toHaveProperty("@x402/express");
      expect(parsed.devDependencies).not.toHaveProperty("@types/express");
    });

    it("should produce valid JSON with x402 dependencies", () => {
      const result = processTemplate(template, x402Config);
      const parsed = JSON.parse(result);

      expect(parsed.name).toBe("paid-agent");
      expect(parsed.dependencies).toHaveProperty("express");
      expect(parsed.dependencies).toHaveProperty("@x402/express");
      expect(parsed.dependencies).toHaveProperty("@x402/core");
      expect(parsed.dependencies).toHaveProperty("@x402/evm");
      expect(parsed.devDependencies).toHaveProperty("@types/express");
    });

    it("should include model dependencies alongside x402", () => {
      const result = processTemplate(template, x402Config);
      const parsed = JSON.parse(result);

      expect(parsed.dependencies).toHaveProperty("openai");
      expect(parsed.dependencies).toHaveProperty("@x402/express");
    });
  });

  describe("env.example.template", () => {
    const template = readTemplate("env.example.template");

    it("should not include x402 vars when disabled", () => {
      const result = processTemplate(template, echoConfig);

      expect(result).toContain("HOST=localhost");
      expect(result).toContain("PORT=3000");
      expect(result).not.toContain("X402_");
    });

    it("should include x402 env vars when enabled", () => {
      const result = processTemplate(template, x402Config);

      expect(result).toContain("X402_PAY_TO_ADDRESS");
      expect(result).toContain("X402_PRICE=$0.05");
      expect(result).toContain("X402_NETWORK=eip155:84532");
      expect(result).toContain("X402_FACILITATOR_URL");
    });

    it("should include model config alongside x402", () => {
      const result = processTemplate(template, x402Config);

      expect(result).toContain("OPENAI_API_KEY");
      expect(result).toContain("X402_PRICE");
    });
  });

  describe("README.md.template", () => {
    const template = readTemplate("README.md.template");

    it("should not include x402 section when disabled", () => {
      const result = processTemplate(template, echoConfig);

      expect(result).toContain("# Echo Bot");
      expect(result).toContain("Echoes back messages");
      expect(result).not.toContain("x402");
      expect(result).not.toContain("X402_PAY_TO_ADDRESS");
      expect(result).not.toContain("{{");
    });

    it("should include x402 section when enabled", () => {
      const result = processTemplate(template, x402Config);

      expect(result).toContain("# Paid Agent");
      expect(result).toContain("x402");
      expect(result).toContain("X402_PAY_TO_ADDRESS");
      expect(result).toContain("USDC");
      expect(result).not.toContain("{{");
    });

    it("should place x402 section before Setup", () => {
      const result = processTemplate(template, x402Config);
      const x402Pos = result.indexOf("x402");
      const setupPos = result.indexOf("## Setup");

      expect(x402Pos).toBeGreaterThan(-1);
      expect(setupPos).toBeGreaterThan(-1);
      expect(x402Pos).toBeLessThan(setupPos);
    });
  });
});
