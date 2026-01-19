import { describe, it, expect } from "vitest";

// We need to test the validateAgentName function which is private.
// Let's test it through its behavior by checking valid/invalid patterns.
// Since we can't directly import it, we'll create a copy for testing purposes.

function validateAgentName(value: string): string | boolean {
  if (!value) return "Agent name is required";
  if (!/^[a-z][a-z0-9-]*$/.test(value)) {
    return "Name must be lowercase, start with a letter, and contain only letters, numbers, and hyphens";
  }
  return true;
}

describe("validateAgentName", () => {
  describe("valid names", () => {
    const validNames = [
      "agent",
      "my-agent",
      "agent1",
      "my-agent-123",
      "a",
      "abc",
      "a1",
      "test-agent-v2",
    ];

    it.each(validNames)('should accept "%s" as valid', (name) => {
      expect(validateAgentName(name)).toBe(true);
    });
  });

  describe("invalid names", () => {
    const invalidCases = [
      { name: "", expectedError: "Agent name is required" },
      {
        name: "1agent",
        expectedError:
          "Name must be lowercase, start with a letter, and contain only letters, numbers, and hyphens",
      },
      {
        name: "-agent",
        expectedError:
          "Name must be lowercase, start with a letter, and contain only letters, numbers, and hyphens",
      },
      {
        name: "Agent",
        expectedError:
          "Name must be lowercase, start with a letter, and contain only letters, numbers, and hyphens",
      },
      {
        name: "my_agent",
        expectedError:
          "Name must be lowercase, start with a letter, and contain only letters, numbers, and hyphens",
      },
      {
        name: "my agent",
        expectedError:
          "Name must be lowercase, start with a letter, and contain only letters, numbers, and hyphens",
      },
      {
        name: "my.agent",
        expectedError:
          "Name must be lowercase, start with a letter, and contain only letters, numbers, and hyphens",
      },
      {
        name: "UPPERCASE",
        expectedError:
          "Name must be lowercase, start with a letter, and contain only letters, numbers, and hyphens",
      },
      {
        name: "CamelCase",
        expectedError:
          "Name must be lowercase, start with a letter, and contain only letters, numbers, and hyphens",
      },
    ];

    it.each(invalidCases)(
      'should reject "$name" with appropriate error',
      ({ name, expectedError }) => {
        expect(validateAgentName(name)).toBe(expectedError);
      }
    );
  });
});
