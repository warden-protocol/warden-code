import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createContext } from "./context.js";

describe("createContext", () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  it("should create context with provided cwd", () => {
    const context = createContext("/test/dir");

    expect(context.cwd).toBe("/test/dir");
  });

  it("should create context with log functions", () => {
    const context = createContext("/test");

    expect(context.log).toBeDefined();
    expect(typeof context.log.info).toBe("function");
    expect(typeof context.log.success).toBe("function");
    expect(typeof context.log.error).toBe("function");
    expect(typeof context.log.warn).toBe("function");
    expect(typeof context.log.dim).toBe("function");
  });

  it("should create context with spinner function", () => {
    const context = createContext("/test");

    expect(typeof context.spinner).toBe("function");
  });

  describe("logger", () => {
    it("should log info messages", () => {
      const context = createContext("/test");

      context.log.info("test message");

      expect(consoleSpy).toHaveBeenCalled();
    });

    it("should log success messages", () => {
      const context = createContext("/test");

      context.log.success("success message");

      expect(consoleSpy).toHaveBeenCalled();
    });

    it("should log error messages", () => {
      const context = createContext("/test");

      context.log.error("error message");

      expect(consoleSpy).toHaveBeenCalled();
    });

    it("should log warning messages", () => {
      const context = createContext("/test");

      context.log.warn("warning message");

      expect(consoleSpy).toHaveBeenCalled();
    });

    it("should log dim messages", () => {
      const context = createContext("/test");

      context.log.dim("dim message");

      expect(consoleSpy).toHaveBeenCalled();
    });
  });

  describe("spinner", () => {
    it("should create a spinner with the given message", () => {
      const context = createContext("/test");

      const spinner = context.spinner("Loading...");

      expect(spinner).toBeDefined();
      expect(typeof spinner.start).toBe("function");
      expect(typeof spinner.succeed).toBe("function");
      expect(typeof spinner.fail).toBe("function");
    });
  });
});
