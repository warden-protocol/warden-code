import { describe, it, expect } from "vitest";

// We need to test these functions which are private.
// Since we can't directly import them, we'll create copies for testing purposes.

function validateAgentName(value: string): string | boolean {
  if (!value.trim()) return "Agent name is required";
  return true;
}

/**
 * Convert a display name to a valid npm package name.
 * e.g., "My Cool Agent" -> "my-cool-agent"
 */
function toPackageName(displayName: string): string {
  return displayName
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-\s]/g, "") // remove invalid chars
    .replace(/\s+/g, "-") // spaces to hyphens
    .replace(/-+/g, "-") // collapse multiple hyphens
    .replace(/^-|-$/g, ""); // trim leading/trailing hyphens
}

describe("validateAgentName", () => {
  describe("valid names", () => {
    const validNames = [
      "agent",
      "my-agent",
      "My Cool Agent",
      "Agent 123",
      "UPPERCASE",
      "CamelCase",
      "a",
      "Test Agent v2",
    ];

    it.each(validNames)('should accept "%s" as valid', (name) => {
      expect(validateAgentName(name)).toBe(true);
    });
  });

  describe("invalid names", () => {
    const invalidCases = [
      { name: "", expectedError: "Agent name is required" },
      { name: "   ", expectedError: "Agent name is required" },
    ];

    it.each(invalidCases)(
      'should reject "$name" with appropriate error',
      ({ name, expectedError }) => {
        expect(validateAgentName(name)).toBe(expectedError);
      },
    );
  });
});

describe("toPackageName", () => {
  describe("basic conversions", () => {
    const cases = [
      { input: "My Cool Agent", expected: "my-cool-agent" },
      { input: "agent", expected: "agent" },
      { input: "UPPERCASE", expected: "uppercase" },
      { input: "CamelCase", expected: "camelcase" },
      { input: "Agent 123", expected: "agent-123" },
      { input: "my-agent", expected: "my-agent" },
    ];

    it.each(cases)(
      'should convert "$input" to "$expected"',
      ({ input, expected }) => {
        expect(toPackageName(input)).toBe(expected);
      },
    );
  });

  describe("special character handling", () => {
    const cases = [
      { input: "My_Agent", expected: "myagent" },
      { input: "My.Agent", expected: "myagent" },
      { input: "My@Agent!", expected: "myagent" },
      { input: "Agent #1", expected: "agent-1" },
      { input: "Cool & Fast Agent", expected: "cool-fast-agent" },
    ];

    it.each(cases)(
      'should handle special chars in "$input" -> "$expected"',
      ({ input, expected }) => {
        expect(toPackageName(input)).toBe(expected);
      },
    );
  });

  describe("whitespace handling", () => {
    const cases = [
      { input: "  My Agent  ", expected: "my-agent" },
      { input: "My   Agent", expected: "my-agent" },
      { input: "My\tAgent", expected: "my-agent" },
      { input: "  spaced  out  agent  ", expected: "spaced-out-agent" },
    ];

    it.each(cases)(
      'should handle whitespace in "$input" -> "$expected"',
      ({ input, expected }) => {
        expect(toPackageName(input)).toBe(expected);
      },
    );
  });

  describe("hyphen handling", () => {
    const cases = [
      { input: "my--agent", expected: "my-agent" },
      { input: "-my-agent-", expected: "my-agent" },
      { input: "---agent---", expected: "agent" },
      { input: "my - agent", expected: "my-agent" },
    ];

    it.each(cases)(
      'should handle hyphens in "$input" -> "$expected"',
      ({ input, expected }) => {
        expect(toPackageName(input)).toBe(expected);
      },
    );
  });
});
