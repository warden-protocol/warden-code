import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";
import { processTemplate, buildPaymentsModule } from "./scaffolder.js";
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
      expect(parsed[0]).toMatchObject({
        id: "calc",
        name: "Calculator",
        description: "Does math",
      });
      expect(parsed[0].tags).toContain(
        "oasf:math_and_coding/mathematical_reasoning/operations",
      );
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

  describe("OASF auto-tagging", () => {
    it("should auto-tag skills with matching OASF categories in {{skills}}", () => {
      const content = "skills: [{{skills}}]";
      const config = createMockConfig({
        skills: [
          {
            id: "coder",
            name: "Code Generator",
            description: "Generates code from natural language prompts",
          },
        ],
      });

      const result = processTemplate(content, config);

      expect(result).toContain(
        "oasf:math_and_coding/coding_skills/text_to_code",
      );
    });

    it("should auto-tag skills with matching OASF categories in {{skills_json}}", () => {
      const content = "[{{skills_json}}]";
      const config = createMockConfig({
        skills: [
          {
            id: "translator",
            name: "Translator",
            description: "Translates documents between languages",
          },
        ],
      });

      const result = processTemplate(content, config);
      const parsed = JSON.parse(result);

      expect(parsed[0].tags).toContain(
        "oasf:natural_language/translation/translation",
      );
    });

    it("should leave tags as empty array when no keywords match", () => {
      const content = "[{{skills_json}}]";
      const config = createMockConfig({
        skills: [
          {
            id: "greeter",
            name: "Greeter",
            description: "Says hello to users",
          },
        ],
      });

      const result = processTemplate(content, config);
      const parsed = JSON.parse(result);

      expect(parsed[0].tags).toEqual([]);
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

    it("should replace {{x402_imports}} with payments module import when x402 is configured", () => {
      const content = "{{x402_imports}}";
      const config = createMockConfig({
        x402: {
          accepts: [
            {
              network: "eip155:84532",
              payTo: "0x1234567890abcdef1234567890abcdef12345678",
              price: "0.01",
            },
          ],
        },
      });

      const result = processTemplate(content, config);

      expect(result).toContain("getPaymentConfig");
      expect(result).toContain("createPaymentApp");
      expect(result).toContain('./payments.js"');
      // x402 package imports now live in payments.ts, not server.ts
      expect(result).not.toContain("@x402/express");
      expect(result).not.toContain("@x402/core/server");
      expect(result).not.toContain('import express from "express"');
    });

    it("should replace {{x402_listen}} with createServer when x402 is not configured", () => {
      const content = "{{x402_listen}}";
      const config = createMockConfig();

      const result = processTemplate(content, config);

      expect(result).toContain("createServer");
      expect(result).toContain("httpServer.listen(PORT");
      expect(result).toContain("serveStatic");
      expect(result).not.toContain("server.listen(PORT)");
      expect(result).not.toContain("express");
      expect(result).not.toContain("paymentMiddleware");
    });

    it("should replace {{x402_listen}} with payment delegation when x402 is configured", () => {
      const content = "{{x402_listen}}";
      const config = createMockConfig({
        x402: {
          accepts: [
            {
              network: "eip155:8453",
              payTo: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
              price: "0.05",
            },
          ],
        },
      });

      const result = processTemplate(content, config);

      // Delegates to payments module
      expect(result).toContain("getPaymentConfig()");
      expect(result).toContain("createPaymentApp(");
      expect(result).toContain("app.listen(PORT");
      // Startup logging references paymentConfig
      expect(result).toContain("paymentConfig.facilitatorUrl");
      expect(result).toContain("paymentConfig.isPayAI");
      expect(result).toContain("paymentConfig.accepts");
      expect(result).toContain("PAYAI_API_KEY_ID");
      // Payment internals are NOT in server.ts anymore
      expect(result).not.toContain("paymentMiddleware");
      expect(result).not.toContain("x402ResourceServer");
      expect(result).not.toContain("x402Networks");
      expect(result).not.toContain("createFacilitatorConfig");
      // Fallback when no networks enabled at runtime
      expect(result).toContain("httpServer.listen(PORT");
      expect(result).not.toContain("server.listen(PORT)");
      // Prices and addresses not hardcoded
      expect(result).not.toContain("0.05");
      expect(result).not.toContain(
        "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
      );
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
        x402: {
          accepts: [
            {
              network: "eip155:84532",
              payTo: "0x1234567890abcdef1234567890abcdef12345678",
              price: "0.01",
            },
          ],
        },
      });

      const result = processTemplate(content, config);

      expect(result).toContain('"express"');
      expect(result).toContain('"@x402/express"');
      expect(result).toContain('"@x402/core"');
      expect(result).toContain('"@payai/facilitator"');
      expect(result).toContain('"@x402/evm"');
    });

    it("should replace {{x402_dev_dependencies}} with @types/express when configured", () => {
      const content = "{{x402_dev_dependencies}}";
      const config = createMockConfig({
        x402: {
          accepts: [
            {
              network: "eip155:84532",
              payTo: "0x1234567890abcdef1234567890abcdef12345678",
              price: "0.01",
            },
          ],
        },
      });

      const result = processTemplate(content, config);

      expect(result).toContain('"@types/express"');
    });

    it("should replace {{x402_support}} with false when x402 is not configured", () => {
      const content = "{{x402_support}}";
      const config = createMockConfig();

      const result = processTemplate(content, config);

      expect(result).toBe("false");
    });

    it("should replace {{x402_support}} with true when x402 is configured", () => {
      const content = "{{x402_support}}";
      const config = createMockConfig({
        x402: {
          accepts: [
            {
              network: "eip155:84532",
              payTo: "0xabc",
              price: "0.01",
            },
          ],
        },
      });

      const result = processTemplate(content, config);

      expect(result).toBe("true");
    });

    it("should replace {{x402_networks}} with empty array when x402 is not configured", () => {
      const content = "{{x402_networks}}";
      const config = createMockConfig();

      const result = processTemplate(content, config);

      expect(result).toBe("[]");
    });

    it("should replace {{x402_networks}} with evm only for EVM networks", () => {
      const content = "{{x402_networks}}";
      const config = createMockConfig({
        x402: {
          accepts: [
            {
              network: "eip155:84532",
              payTo: "0xabc",
              price: "0.01",
            },
          ],
        },
      });

      const result = processTemplate(content, config);

      expect(JSON.parse(result)).toEqual(["evm"]);
    });

    it("should replace {{x402_networks}} with solana only for Solana networks", () => {
      const content = "{{x402_networks}}";
      const config = createMockConfig({
        x402: {
          accepts: [
            {
              network: "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1",
              payTo: "SomeSolAddress",
              price: "0.01",
            },
          ],
        },
      });

      const result = processTemplate(content, config);

      expect(JSON.parse(result)).toEqual(["solana"]);
    });

    it("should replace {{x402_networks}} with both evm and solana for mixed networks", () => {
      const content = "{{x402_networks}}";
      const config = createMockConfig({
        x402: {
          accepts: [
            {
              network: "eip155:84532",
              payTo: "0xabc",
              price: "0.01",
            },
            {
              network: "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1",
              payTo: "SomeSolAddress",
              price: "0.01",
            },
          ],
        },
      });

      const result = processTemplate(content, config);

      expect(JSON.parse(result)).toEqual(["evm", "solana"]);
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
        x402: {
          accepts: [
            {
              network: "eip155:84532",
              payTo: "0x1234567890abcdef1234567890abcdef12345678",
              price: "0.01",
            },
          ],
        },
      });

      const result = processTemplate(content, config);

      // Active network section (placeholder values, not actual config)
      expect(result).toContain("X402_BASE_SEPOLIA_PAY_TO=");
      expect(result).not.toContain(
        "0x1234567890abcdef1234567890abcdef12345678",
      );
      expect(result).toContain("X402_BASE_SEPOLIA_PRICE=0.01");
      expect(result).toContain("X402_BASE_SEPOLIA_NETWORK=eip155:84532");
      // Other networks are commented out
      expect(result).toContain("# X402_BASE_PAY_TO=");
      expect(result).toContain("# X402_SOL_DEVNET_PAY_TO=");
      expect(result).toContain("# X402_SOL_PAY_TO=");
      // Single facilitator URL (testnet-only defaults to x402.org)
      expect(result).toContain(
        "X402_FACILITATOR_URL=https://x402.org/facilitator",
      );
      // No per-network facilitator URLs
      expect(result).not.toContain("X402_BASE_SEPOLIA_FACILITATOR_URL");
      // No PayAI auth hint for testnet-only config
      expect(result).not.toContain("PAYAI_API_KEY_ID");
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
        x402: {
          accepts: [
            {
              network: "eip155:84532",
              payTo: "0x1234567890abcdef1234567890abcdef12345678",
              price: "0.01",
            },
          ],
        },
      });

      const result = processTemplate(content, config);

      expect(result).toContain("x402");
      expect(result).toContain("X402_<NETWORK>_PAY_TO");
      expect(result).toContain("USDC");
      expect(result).toContain("remove all");
      // Facilitator documentation
      expect(result).toContain("X402_FACILITATOR_URL");
      expect(result).toContain("facilitator");
    });

    it("should resolve {{name}} inside {{x402_listen}} content", () => {
      const content = "{{x402_listen}}";
      const config = createMockConfig({
        name: "Payment Agent",
        x402: {
          accepts: [
            {
              network: "eip155:84532",
              payTo: "0x1234567890abcdef1234567890abcdef12345678",
              price: "0.01",
            },
          ],
        },
      });

      const result = processTemplate(content, config);

      expect(result).toContain("Payment Agent");
      expect(result).not.toContain("{{name}}");
    });

    it("should resolve {{description}} inside {{x402_listen}} content", () => {
      const content = "{{x402_listen}}";
      const config = createMockConfig({
        description: "A paid agent",
        x402: {
          accepts: [
            {
              network: "eip155:84532",
              payTo: "0x1234567890abcdef1234567890abcdef12345678",
              price: "0.01",
            },
          ],
        },
      });

      const result = processTemplate(content, config);

      expect(result).toContain("A paid agent");
      expect(result).not.toContain("{{description}}");
    });

    it("should use same payments module import regardless of network type", () => {
      const svmContent = processTemplate(
        "{{x402_imports}}",
        createMockConfig({
          x402: {
            accepts: [
              {
                network: "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1",
                payTo: "So11111111111111111111111111111111111111112",
                price: "0.01",
              },
            ],
          },
        }),
      );
      const mixedContent = processTemplate(
        "{{x402_imports}}",
        createMockConfig({
          x402: {
            accepts: [
              {
                network: "eip155:84532",
                payTo: "0x1234567890abcdef1234567890abcdef12345678",
                price: "0.01",
              },
              {
                network: "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1",
                payTo: "So11111111111111111111111111111111111111112",
                price: "0.02",
              },
            ],
          },
        }),
      );

      // Both produce the same single-line import
      expect(svmContent).toBe(mixedContent);
      expect(svmContent).toContain("getPaymentConfig");
      expect(svmContent).toContain("createPaymentApp");
    });

    it("should delegate to payments module in {{x402_listen}} for mixed config", () => {
      const content = "{{x402_listen}}";
      const config = createMockConfig({
        x402: {
          accepts: [
            {
              network: "eip155:84532",
              payTo: "0xaabbccddee11223344556677889900aabbccddee",
              price: "0.01",
            },
            {
              network: "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1",
              payTo: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
              price: "0.05",
            },
          ],
        },
      });

      const result = processTemplate(content, config);

      // Pay-to addresses not hardcoded in server.ts
      expect(result).not.toContain(
        "0xaabbccddee11223344556677889900aabbccddee",
      );
      expect(result).not.toContain(
        "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
      );
      // Delegates to payments module (no inline payment logic)
      expect(result).toContain("getPaymentConfig()");
      expect(result).toContain("createPaymentApp(");
      expect(result).not.toContain("x402Networks");
      expect(result).not.toContain("registerExactEvmScheme");
      expect(result).not.toContain("registerExactSvmScheme");
    });

    it("should include @x402/svm dependency for Solana config", () => {
      const content = "{{x402_dependencies}}";
      const config = createMockConfig({
        x402: {
          accepts: [
            {
              network: "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1",
              payTo: "So11111111111111111111111111111111111111112",
              price: "0.01",
            },
          ],
        },
      });

      const result = processTemplate(content, config);

      expect(result).toContain('"@x402/svm"');
      expect(result).not.toContain('"@x402/evm"');
    });

    it("should include both @x402/evm and @x402/svm for mixed config", () => {
      const content = "{{x402_dependencies}}";
      const config = createMockConfig({
        x402: {
          accepts: [
            {
              network: "eip155:84532",
              payTo: "0x1234567890abcdef1234567890abcdef12345678",
              price: "0.01",
            },
            {
              network: "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1",
              payTo: "So11111111111111111111111111111111111111112",
              price: "0.01",
            },
          ],
        },
      });

      const result = processTemplate(content, config);

      expect(result).toContain('"@x402/evm"');
      expect(result).toContain('"@x402/svm"');
    });

    it("should not contain scheme registrations in {{x402_listen}} (moved to payments.ts)", () => {
      const content = "{{x402_listen}}";
      const config = createMockConfig({
        x402: {
          accepts: [
            {
              network: "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1",
              payTo: "So11111111111111111111111111111111111111112",
              price: "0.01",
            },
          ],
        },
      });

      const result = processTemplate(content, config);

      expect(result).not.toContain("registerExactSvmScheme");
      expect(result).not.toContain("registerExactEvmScheme");
      expect(result).toContain("createPaymentApp(");
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
    x402: {
      accepts: [
        {
          network: "eip155:84532",
          payTo: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
          price: "0.05",
        },
      ],
    },
  });

  describe("server.ts.template", () => {
    const template = readTemplate("server.ts.template");

    it("should produce valid output without x402", () => {
      const result = processTemplate(template, echoConfig);

      expect(result).toContain('import "dotenv/config"');
      expect(result).toContain("AgentServer");
      expect(result).toContain("createServer");
      expect(result).toContain("httpServer.listen(PORT");
      expect(result).toContain("serveStatic");
      expect(result).toContain("PUBLIC_DIR");
      expect(result).toContain("MIME_TYPES");
      expect(result).not.toContain("server.listen(PORT)");
      expect(result).not.toContain("{{");
      expect(result).not.toContain("express");
      expect(result).not.toContain("paymentMiddleware");
    });

    it("should delegate to payments module with x402", () => {
      const result = processTemplate(template, x402Config);

      expect(result).toContain('import "dotenv/config"');
      expect(result).toContain("AgentServer");
      // Imports from payments module, not inline x402 packages
      expect(result).toContain("getPaymentConfig");
      expect(result).toContain("createPaymentApp");
      expect(result).not.toContain('import express from "express"');
      expect(result).not.toContain("paymentMiddleware");
      expect(result).not.toContain("x402ResourceServer");
      // Startup and fallback paths
      expect(result).toContain("app.listen(PORT");
      expect(result).toContain("httpServer.listen(PORT");
      expect(result).not.toContain("server.listen(PORT)");
      expect(result).not.toContain('"0.05"');
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
      expect(parsed.dependencies).toHaveProperty("@payai/facilitator");
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

      expect(result).toContain("X402_BASE_SEPOLIA_PAY_TO=");
      expect(result).toContain("X402_BASE_SEPOLIA_NETWORK=eip155:84532");
      // Single facilitator URL
      expect(result).toContain("X402_FACILITATOR_URL=");
      expect(result).not.toContain("X402_BASE_SEPOLIA_FACILITATOR_URL");
      // All networks should be present (active or commented)
      expect(result).toContain("# X402_SOL_DEVNET_PAY_TO=");
    });

    it("should include model config alongside x402", () => {
      const result = processTemplate(template, x402Config);

      expect(result).toContain("OPENAI_API_KEY");
      expect(result).toContain("X402_BASE_SEPOLIA_PAY_TO");
    });
  });

  describe("README.md.template", () => {
    const template = readTemplate("README.md.template");

    it("should not include x402 section when disabled", () => {
      const result = processTemplate(template, echoConfig);

      expect(result).toContain("# Echo Bot");
      expect(result).toContain("Echoes back messages");
      expect(result).not.toContain("x402");
      expect(result).not.toContain("X402_ENABLED");
      expect(result).not.toContain("{{");
    });

    it("should include x402 section when enabled", () => {
      const result = processTemplate(template, x402Config);

      expect(result).toContain("# Paid Agent");
      expect(result).toContain("x402");
      expect(result).toContain("X402_FACILITATOR_URL");
      expect(result).toContain("X402_<NETWORK>_PAY_TO");
      expect(result).toContain("USDC");
      expect(result).toContain("PAYAI_API_KEY_ID");
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

describe("buildPaymentsModule", () => {
  it("should return null when x402 is not configured", () => {
    const config = createMockConfig();
    expect(buildPaymentsModule(config)).toBeNull();
  });

  it("should return module content when x402 is configured", () => {
    const config = createMockConfig({
      x402: {
        accepts: [
          {
            network: "eip155:84532",
            payTo: "0x1234567890abcdef1234567890abcdef12345678",
            price: "0.01",
          },
        ],
      },
    });

    const result = buildPaymentsModule(config);

    expect(result).not.toBeNull();
    expect(result).toContain("getPaymentConfig");
    expect(result).toContain("createPaymentApp");
    expect(result).toContain("PaymentConfig");
    expect(result).toContain("PaymentAccept");
  });

  it("should include x402 package imports", () => {
    const config = createMockConfig({
      x402: {
        accepts: [
          {
            network: "eip155:84532",
            payTo: "0x1234567890abcdef1234567890abcdef12345678",
            price: "0.01",
          },
        ],
      },
    });

    const result = buildPaymentsModule(config)!;

    expect(result).toContain('import express from "express"');
    expect(result).toContain("@x402/express");
    expect(result).toContain("@x402/core/server");
    expect(result).toContain("@payai/facilitator");
    expect(result).toContain("@x402/evm/exact/server");
  });

  it("should include SVM import for Solana config", () => {
    const config = createMockConfig({
      x402: {
        accepts: [
          {
            network: "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1",
            payTo: "So11111111111111111111111111111111111111112",
            price: "0.01",
          },
        ],
      },
    });

    const result = buildPaymentsModule(config)!;

    expect(result).toContain("@x402/svm/exact/server");
    expect(result).not.toContain("@x402/evm/exact/server");
  });

  it("should include both EVM and SVM imports for mixed config", () => {
    const config = createMockConfig({
      x402: {
        accepts: [
          {
            network: "eip155:84532",
            payTo: "0x1234567890abcdef1234567890abcdef12345678",
            price: "0.01",
          },
          {
            network: "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1",
            payTo: "So11111111111111111111111111111111111111112",
            price: "0.02",
          },
        ],
      },
    });

    const result = buildPaymentsModule(config)!;

    expect(result).toContain("@x402/evm/exact/server");
    expect(result).toContain("@x402/svm/exact/server");
  });

  it("should contain x402Networks lookup table", () => {
    const config = createMockConfig({
      x402: {
        accepts: [
          {
            network: "eip155:84532",
            payTo: "0x1234567890abcdef1234567890abcdef12345678",
            price: "0.01",
          },
        ],
      },
    });

    const result = buildPaymentsModule(config)!;

    expect(result).toContain("x402Networks");
    expect(result).toContain("BASE_SEPOLIA");
    expect(result).toContain("eip155:84532");
    expect(result).toContain("eip155:8453");
    expect(result).toContain("solana:");
  });

  it("should contain payment middleware and CORS setup", () => {
    const config = createMockConfig({
      x402: {
        accepts: [
          {
            network: "eip155:84532",
            payTo: "0x1234567890abcdef1234567890abcdef12345678",
            price: "0.01",
          },
        ],
      },
    });

    const result = buildPaymentsModule(config)!;

    expect(result).toContain("paymentMiddleware");
    expect(result).toContain("x402ResourceServer");
    expect(result).toContain("Access-Control-Allow-Origin");
    expect(result).toContain("PAYMENT-SIGNATURE");
    expect(result).toContain("PAYMENT-REQUIRED");
  });

  it("should contain facilitator client with PayAI detection", () => {
    const config = createMockConfig({
      x402: {
        accepts: [
          {
            network: "eip155:84532",
            payTo: "0x1234567890abcdef1234567890abcdef12345678",
            price: "0.01",
          },
        ],
      },
    });

    const result = buildPaymentsModule(config)!;

    expect(result).toContain("HTTPFacilitatorClient");
    expect(result).toContain("createFacilitatorConfig");
    expect(result).toContain("X402_FACILITATOR_URL");
    expect(result).toContain("payai.network");
  });

  it("should contain scheme registration for EVM config", () => {
    const config = createMockConfig({
      x402: {
        accepts: [
          {
            network: "eip155:84532",
            payTo: "0x1234567890abcdef1234567890abcdef12345678",
            price: "0.01",
          },
        ],
      },
    });

    const result = buildPaymentsModule(config)!;

    expect(result).toContain("registerExactEvmScheme");
    expect(result).not.toContain("registerExactSvmScheme");
  });

  it("should contain route dispatch logic", () => {
    const config = createMockConfig({
      x402: {
        accepts: [
          {
            network: "eip155:84532",
            payTo: "0x1234567890abcdef1234567890abcdef12345678",
            price: "0.01",
          },
        ],
      },
    });

    const result = buildPaymentsModule(config)!;

    expect(result).toContain("isLangGraph");
    expect(result).toContain("/assistants");
    expect(result).toContain("/threads");
    expect(result).toContain("a2aHandler");
    expect(result).toContain("langGraphHandler");
    expect(result).toContain("express.static");
    expect(result).toContain("return app");
  });

  it("should not contain hardcoded wallet addresses or prices", () => {
    const config = createMockConfig({
      x402: {
        accepts: [
          {
            network: "eip155:84532",
            payTo: "0x1234567890abcdef1234567890abcdef12345678",
            price: "0.99",
          },
        ],
      },
    });

    const result = buildPaymentsModule(config)!;

    expect(result).not.toContain("0x1234567890abcdef1234567890abcdef12345678");
    expect(result).not.toContain("0.99");
  });
});
