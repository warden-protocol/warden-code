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

// Mirrors the inline validation in the x402 wallet address prompt.
function validateEvmAddress(value: string): string | boolean {
  return (
    /^0x[a-fA-F0-9]{40}$/.test(value.trim()) ||
    "Enter a valid Ethereum address (0x followed by 40 hex characters)"
  );
}

function validateSolanaAddress(value: string): string | boolean {
  return (
    /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(value.trim()) ||
    "Enter a valid Solana address (base58, 32-44 characters)"
  );
}

describe("validateEvmAddress", () => {
  describe("valid addresses", () => {
    const validAddresses = [
      "0x1234567890abcdef1234567890abcdef12345678",
      "0xABCDEF1234567890ABCDEF1234567890ABCDEF12",
      "0xaabbccddee11223344556677889900aabbccddee",
      "0x0000000000000000000000000000000000000000",
      "0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF",
    ];

    it.each(validAddresses)('should accept "%s" as valid', (addr) => {
      expect(validateEvmAddress(addr)).toBe(true);
    });

    it("should trim whitespace before validating", () => {
      expect(
        validateEvmAddress("  0x1234567890abcdef1234567890abcdef12345678  "),
      ).toBe(true);
    });
  });

  describe("invalid addresses", () => {
    const invalidCases = [
      { addr: "", reason: "empty string" },
      { addr: "0x", reason: "0x prefix only" },
      {
        addr: "1234567890abcdef1234567890abcdef12345678",
        reason: "missing 0x prefix",
      },
      {
        addr: "0x1234567890abcdef1234567890abcdef1234567",
        reason: "39 hex chars (too short)",
      },
      {
        addr: "0x1234567890abcdef1234567890abcdef123456789",
        reason: "41 hex chars (too long)",
      },
      {
        addr: "0xGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG",
        reason: "non-hex characters",
      },
      {
        addr: "0x1234567890abcdef1234567890abcdef1234567z",
        reason: "trailing non-hex char",
      },
      { addr: "hello world", reason: "arbitrary string" },
    ];

    it.each(invalidCases)('should reject "$addr" ($reason)', ({ addr }) => {
      expect(validateEvmAddress(addr)).toBe(
        "Enter a valid Ethereum address (0x followed by 40 hex characters)",
      );
    });
  });
});

describe("validateSolanaAddress", () => {
  describe("valid addresses", () => {
    const validAddresses = [
      "11111111111111111111111111111111",
      "So11111111111111111111111111111111111111112",
      "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
      "9noXzpXnkyEcKF3AeXqUHTdR59V5uvrRBUZ9bwfQwxeq",
      "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
    ];

    it.each(validAddresses)('should accept "%s" as valid', (addr) => {
      expect(validateSolanaAddress(addr)).toBe(true);
    });

    it("should trim whitespace before validating", () => {
      expect(
        validateSolanaAddress(
          "  So11111111111111111111111111111111111111112  ",
        ),
      ).toBe(true);
    });
  });

  describe("invalid addresses", () => {
    const invalidCases = [
      { addr: "", reason: "empty string" },
      { addr: "abc", reason: "too short (3 chars)" },
      {
        addr: "0x1234567890abcdef1234567890abcdef12345678",
        reason: "EVM address (0x prefix not in base58)",
      },
      {
        addr: "O0000000000000000000000000000000",
        reason: "contains O (not in base58)",
      },
      {
        addr: "I0000000000000000000000000000000",
        reason: "contains I (not in base58)",
      },
      {
        addr: "l0000000000000000000000000000000",
        reason: "contains l (not in base58)",
      },
      {
        addr: "000000000000000000000000000000000000000000000",
        reason: "45 chars (too long)",
      },
    ];

    it.each(invalidCases)('should reject "$addr" ($reason)', ({ addr }) => {
      expect(validateSolanaAddress(addr)).toBe(
        "Enter a valid Solana address (base58, 32-44 characters)",
      );
    });
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
