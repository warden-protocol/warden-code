import { describe, it, expect, beforeEach, vi } from "vitest";
import { CommandRegistry } from "./registry.js";
import type { SlashCommand, CliContext, Logger } from "../types.js";

function createMockLogger(): Logger {
  return {
    info: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    dim: vi.fn(),
  };
}

function createMockContext(): CliContext {
  return {
    cwd: "/test",
    log: createMockLogger(),
    spinner: vi.fn(),
  };
}

function createMockCommand(overrides: Partial<SlashCommand> = {}): SlashCommand {
  return {
    name: "test",
    description: "Test command",
    handler: vi.fn(),
    ...overrides,
  };
}

describe("CommandRegistry", () => {
  let registry: CommandRegistry;

  beforeEach(() => {
    registry = new CommandRegistry();
  });

  describe("register", () => {
    it("should register a command", () => {
      const command = createMockCommand({ name: "foo" });
      registry.register(command);

      expect(registry.has("foo")).toBe(true);
    });

    it("should register command aliases", () => {
      const command = createMockCommand({
        name: "help",
        aliases: ["h", "?"],
      });
      registry.register(command);

      expect(registry.has("help")).toBe(true);
      expect(registry.has("h")).toBe(true);
      expect(registry.has("?")).toBe(true);
    });
  });

  describe("get", () => {
    it("should return the command by name", () => {
      const command = createMockCommand({ name: "foo" });
      registry.register(command);

      expect(registry.get("foo")).toBe(command);
    });

    it("should return the command by alias", () => {
      const command = createMockCommand({
        name: "help",
        aliases: ["h"],
      });
      registry.register(command);

      expect(registry.get("h")).toBe(command);
    });

    it("should return undefined for unknown command", () => {
      expect(registry.get("unknown")).toBeUndefined();
    });
  });

  describe("has", () => {
    it("should return true for registered command", () => {
      registry.register(createMockCommand({ name: "foo" }));
      expect(registry.has("foo")).toBe(true);
    });

    it("should return true for alias", () => {
      registry.register(createMockCommand({ name: "foo", aliases: ["f"] }));
      expect(registry.has("f")).toBe(true);
    });

    it("should return false for unknown command", () => {
      expect(registry.has("unknown")).toBe(false);
    });
  });

  describe("all", () => {
    it("should return all registered commands", () => {
      const cmd1 = createMockCommand({ name: "cmd1" });
      const cmd2 = createMockCommand({ name: "cmd2" });
      registry.register(cmd1);
      registry.register(cmd2);

      const all = registry.all();
      expect(all).toHaveLength(2);
      expect(all).toContain(cmd1);
      expect(all).toContain(cmd2);
    });

    it("should return empty array when no commands registered", () => {
      expect(registry.all()).toEqual([]);
    });
  });

  describe("execute", () => {
    it("should execute a valid command", async () => {
      const handler = vi.fn();
      const command = createMockCommand({ name: "test", handler });
      registry.register(command);
      const context = createMockContext();

      const result = await registry.execute("/test", context);

      expect(result).toBe(true);
      expect(handler).toHaveBeenCalledWith([], context);
    });

    it("should pass arguments to command handler", async () => {
      const handler = vi.fn();
      const command = createMockCommand({ name: "new", handler });
      registry.register(command);
      const context = createMockContext();

      await registry.execute("/new my-agent", context);

      expect(handler).toHaveBeenCalledWith(["my-agent"], context);
    });

    it("should pass multiple arguments to command handler", async () => {
      const handler = vi.fn();
      const command = createMockCommand({ name: "cmd", handler });
      registry.register(command);
      const context = createMockContext();

      await registry.execute("/cmd arg1 arg2 arg3", context);

      expect(handler).toHaveBeenCalledWith(["arg1", "arg2", "arg3"], context);
    });

    it("should execute command by alias", async () => {
      const handler = vi.fn();
      const command = createMockCommand({
        name: "help",
        aliases: ["h"],
        handler,
      });
      registry.register(command);
      const context = createMockContext();

      await registry.execute("/h", context);

      expect(handler).toHaveBeenCalled();
    });

    it("should log error for unknown command", async () => {
      const context = createMockContext();

      const result = await registry.execute("/unknown", context);

      expect(result).toBe(true);
      expect(context.log.error).toHaveBeenCalledWith("Unknown command: /unknown");
      expect(context.log.dim).toHaveBeenCalledWith(
        "Type /help to see available commands"
      );
    });

    it("should return false for non-command input", async () => {
      const context = createMockContext();

      const result = await registry.execute("not a command", context);

      expect(result).toBe(false);
    });

    it("should return false for empty input", async () => {
      const context = createMockContext();

      const result = await registry.execute("", context);

      expect(result).toBe(false);
    });

    it("should handle command names case-insensitively", async () => {
      const handler = vi.fn();
      const command = createMockCommand({ name: "test", handler });
      registry.register(command);
      const context = createMockContext();

      await registry.execute("/TEST", context);

      expect(handler).toHaveBeenCalled();
    });

    it("should trim whitespace from input", async () => {
      const handler = vi.fn();
      const command = createMockCommand({ name: "test", handler });
      registry.register(command);
      const context = createMockContext();

      await registry.execute("  /test  ", context);

      expect(handler).toHaveBeenCalled();
    });
  });
});
