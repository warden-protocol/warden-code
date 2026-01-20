import { describe, it, expect } from "vitest";
import { processTemplate } from "./scaffolder.js";
import type { AgentConfig } from "../types.js";

function createMockConfig(overrides: Partial<AgentConfig> = {}): AgentConfig {
  return {
    name: "Test Agent",
    packageName: "test-agent",
    description: "A test agent",
    template: "blank",
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
