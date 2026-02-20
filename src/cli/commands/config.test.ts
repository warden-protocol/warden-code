import { describe, it, expect } from "vitest";
import { configCommand, suggestAgentUrl } from "./config.js";

describe("configCommand", () => {
  it("should have the correct name", () => {
    expect(configCommand.name).toBe("config");
  });

  it("should have a description", () => {
    expect(configCommand.description).toBe(
      "View and edit agent configuration",
    );
  });

  it("should have aliases", () => {
    expect(configCommand.aliases).toEqual(["cfg"]);
  });

  it("should have usage", () => {
    expect(configCommand.usage).toBe("/config [path] [show]");
  });

  it("should have order 8", () => {
    expect(configCommand.order).toBe(8);
  });

  it("should have a handler function", () => {
    expect(typeof configCommand.handler).toBe("function");
  });
});

describe("suggestAgentUrl", () => {
  it("should use https with no port for port 443", () => {
    expect(suggestAgentUrl("example.com", "443")).toBe("https://example.com");
  });

  it("should use http with no port for port 80", () => {
    expect(suggestAgentUrl("example.com", "80")).toBe("http://example.com");
  });

  it("should use http with port for other ports", () => {
    expect(suggestAgentUrl("0.0.0.0", "3000")).toBe("http://0.0.0.0:3000");
  });

  it("should handle localhost", () => {
    expect(suggestAgentUrl("localhost", "8080")).toBe("http://localhost:8080");
  });
});
