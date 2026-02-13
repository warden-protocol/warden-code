import { describe, it, expect } from "vitest";
import { processTemplate } from "./scaffolder.js";
import type { AgentConfig } from "../types.js";

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
