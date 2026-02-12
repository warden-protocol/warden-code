import { describe, it, expect } from "vitest";
import { formatAPIError, isNonRecoverableError } from "./provider.js";

function makeApiError(status: number, error?: unknown) {
  return Object.assign(new Error(`${status}`), { status, error });
}

describe("formatAPIError", () => {
  it("should format 401 as invalid API key", () => {
    const err = makeApiError(401);
    expect(formatAPIError(err)).toBe(
      "Invalid API key. Run /build again to reconfigure.",
    );
  });

  it("should format 403 as access denied", () => {
    const err = makeApiError(403);
    expect(formatAPIError(err)).toBe(
      "Access denied. Your API key does not have permission to use this model.",
    );
  });

  it("should format 400 with credit balance message", () => {
    const err = makeApiError(400, {
      message: "Your credit balance is too low",
    });
    expect(formatAPIError(err)).toBe(
      "Insufficient API credits. Top up your balance at your provider's billing page.",
    );
  });

  it("should format 400 with context length message", () => {
    const err = makeApiError(400, {
      message: "maximum context length exceeded",
    });
    expect(formatAPIError(err)).toBe(
      "The conversation is too long for this model. Start a new /build session.",
    );
  });

  it("should format 400 with too many tokens message", () => {
    const err = makeApiError(400, {
      message: "too many tokens in request",
    });
    expect(formatAPIError(err)).toBe(
      "The conversation is too long for this model. Start a new /build session.",
    );
  });

  it("should format 400 with generic body", () => {
    const err = makeApiError(400, { message: "something went wrong" });
    expect(formatAPIError(err)).toBe("Bad request: something went wrong");
  });

  it("should format 404 as model not found", () => {
    const err = makeApiError(404);
    expect(formatAPIError(err)).toBe(
      "Model not found. Check your model name and try again.",
    );
  });

  it("should format 429 as rate limited", () => {
    const err = makeApiError(429);
    expect(formatAPIError(err)).toBe(
      "Rate limited. Wait a moment and try again.",
    );
  });

  it("should format 500 as provider issues", () => {
    const err = makeApiError(500);
    expect(formatAPIError(err)).toBe(
      "The provider is experiencing issues. Try again shortly.",
    );
  });

  it("should format 503 as provider issues", () => {
    const err = makeApiError(503);
    expect(formatAPIError(err)).toBe(
      "The provider is experiencing issues. Try again shortly.",
    );
  });

  it("should format connection errors", () => {
    class APIConnectionError extends Error {
      constructor() {
        super("Connection failed");
      }
    }
    const err = new APIConnectionError();
    expect(formatAPIError(err)).toBe(
      "Could not reach the provider. Check your internet connection.",
    );
  });

  it("should fall back to String() for unknown errors", () => {
    expect(formatAPIError("something broke")).toBe("something broke");
  });

  it("should fall back to String() for plain Error", () => {
    const err = new Error("generic failure");
    expect(formatAPIError(err)).toBe("Error: generic failure");
  });

  it("should extract string error body", () => {
    const err = makeApiError(400, "raw string error");
    expect(formatAPIError(err)).toBe("Bad request: raw string error");
  });
});

describe("isNonRecoverableError", () => {
  it("should return true for 401", () => {
    expect(isNonRecoverableError(makeApiError(401))).toBe(true);
  });

  it("should return true for 403", () => {
    expect(isNonRecoverableError(makeApiError(403))).toBe(true);
  });

  it("should return false for 400", () => {
    expect(isNonRecoverableError(makeApiError(400))).toBe(false);
  });

  it("should return false for 429", () => {
    expect(isNonRecoverableError(makeApiError(429))).toBe(false);
  });

  it("should return false for 500", () => {
    expect(isNonRecoverableError(makeApiError(500))).toBe(false);
  });

  it("should return false for plain Error", () => {
    expect(isNonRecoverableError(new Error("fail"))).toBe(false);
  });

  it("should return false for non-error values", () => {
    expect(isNonRecoverableError("string")).toBe(false);
    expect(isNonRecoverableError(null)).toBe(false);
    expect(isNonRecoverableError(undefined)).toBe(false);
  });
});
