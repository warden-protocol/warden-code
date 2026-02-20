import { describe, it, expect } from "vitest";
import { configCommand } from "./config.js";

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
