import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { probeAgent } from "./probe.js";

const originalFetch = globalThis.fetch;

function mockFetch(handler: (url: string) => Response | Promise<Response>) {
  globalThis.fetch = vi.fn((input: string | URL | Request) => {
    const url = typeof input === "string" ? input : input.toString();
    return Promise.resolve(handler(url));
  }) as unknown as typeof fetch;
}

function jsonResponse(body: unknown, contentType = "application/json") {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": contentType },
  });
}

function htmlResponse() {
  return new Response("<html></html>", {
    status: 200,
    headers: { "Content-Type": "text/html" },
  });
}

function notFound() {
  return new Response("Not Found", { status: 404 });
}

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("probeAgent", () => {
  describe("A2A detection", () => {
    it("should detect A2A from agent card", async () => {
      mockFetch((url) => {
        if (url.includes("agent-card.json")) {
          return jsonResponse({
            name: "Test Agent",
            description: "A test agent",
            capabilities: { streaming: true },
            skills: [{ id: "s1", name: "Skill One" }],
          });
        }
        return notFound();
      });

      const result = await probeAgent("http://localhost:3000");

      expect(result.a2a).not.toBeNull();
      expect(result.a2a!.protocol).toBe("a2a");
      expect(result.a2a!.name).toBe("Test Agent");
      expect(result.a2a!.description).toBe("A test agent");
      expect(result.a2a!.capabilities).toContain("streaming");
      expect(result.a2a!.capabilities).toContain("Skill One");
    });

    it("should return null when agent card returns 404", async () => {
      mockFetch(() => notFound());

      const result = await probeAgent("http://localhost:3000");

      expect(result.a2a).toBeNull();
    });

    it("should return null when agent card returns HTML", async () => {
      mockFetch(() => htmlResponse());

      const result = await probeAgent("http://localhost:3000");

      expect(result.a2a).toBeNull();
    });

    it("should return null when agent card has no name", async () => {
      mockFetch((url) => {
        if (url.includes("agent-card.json")) {
          return jsonResponse({ description: "no name field" });
        }
        return notFound();
      });

      const result = await probeAgent("http://localhost:3000");

      expect(result.a2a).toBeNull();
    });

    it("should return null when fetch throws", async () => {
      mockFetch(() => {
        throw new TypeError("fetch failed");
      });

      const result = await probeAgent("http://localhost:3000");

      expect(result.a2a).toBeNull();
    });
  });

  describe("LangGraph detection", () => {
    it("should detect LangGraph from /info endpoint", async () => {
      mockFetch((url) => {
        if (url.endsWith("/info")) {
          return jsonResponse({
            name: "LG Agent",
            description: "A LangGraph agent",
          });
        }
        return notFound();
      });

      const result = await probeAgent("http://localhost:3000");

      expect(result.langgraph).not.toBeNull();
      expect(result.langgraph!.protocol).toBe("langgraph");
      expect(result.langgraph!.name).toBe("LG Agent");
      expect(result.langgraph!.description).toBe("A LangGraph agent");
    });

    it("should use default name when /info has no name", async () => {
      mockFetch((url) => {
        if (url.endsWith("/info")) {
          return jsonResponse({ version: "1.0.0" });
        }
        return notFound();
      });

      const result = await probeAgent("http://localhost:3000");

      expect(result.langgraph).not.toBeNull();
      expect(result.langgraph!.name).toBe("LangGraph Agent");
    });

    it("should return null when /info returns 404", async () => {
      mockFetch(() => notFound());

      const result = await probeAgent("http://localhost:3000");

      expect(result.langgraph).toBeNull();
    });

    it("should return null when /info returns HTML", async () => {
      mockFetch((url) => {
        if (url.endsWith("/info")) return htmlResponse();
        return notFound();
      });

      const result = await probeAgent("http://localhost:3000");

      expect(result.langgraph).toBeNull();
    });
  });

  describe("dual protocol detection", () => {
    it("should detect both A2A and LangGraph", async () => {
      mockFetch((url) => {
        if (url.includes("agent-card.json")) {
          return jsonResponse({ name: "Dual Agent" });
        }
        if (url.endsWith("/info")) {
          return jsonResponse({ name: "Dual Agent LG" });
        }
        return notFound();
      });

      const result = await probeAgent("http://localhost:3000");

      expect(result.a2a).not.toBeNull();
      expect(result.langgraph).not.toBeNull();
    });

    it("should return both null when nothing is detected", async () => {
      mockFetch(() => notFound());

      const result = await probeAgent("http://localhost:3000");

      expect(result.a2a).toBeNull();
      expect(result.langgraph).toBeNull();
    });
  });
});
