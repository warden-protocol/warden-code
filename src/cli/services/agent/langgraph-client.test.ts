import { describe, it, expect, vi, afterEach } from "vitest";
import { LangGraphClient } from "./langgraph-client.js";
import { AgentRequestError } from "./a2a-client.js";

const originalFetch = globalThis.fetch;

function mockFetch(handler: (url: string, init?: RequestInit) => Response | Promise<Response>) {
  globalThis.fetch = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input.toString();
    return Promise.resolve(handler(url, init));
  }) as unknown as typeof fetch;
}

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("LangGraphClient", () => {
  describe("connect", () => {
    it("should create a thread", async () => {
      mockFetch((url) => {
        if (url.endsWith("/threads")) {
          return jsonResponse({ thread_id: "thread-abc" });
        }
        return new Response("Not Found", { status: 404 });
      });

      const client = new LangGraphClient("http://localhost:3000");
      await client.connect();

      // If connect doesn't throw, the thread was created
      expect(true).toBe(true);
    });

    it("should throw AgentRequestError on failed thread creation", async () => {
      mockFetch(() => new Response("Internal Error", { status: 500 }));

      const client = new LangGraphClient("http://localhost:3000");

      await expect(client.connect()).rejects.toThrow(AgentRequestError);
    });
  });

  describe("send", () => {
    it("should throw if not connected", async () => {
      const client = new LangGraphClient("http://localhost:3000");

      await expect(client.send("Hello")).rejects.toThrow("Not connected");
    });

    it("should extract AI messages from values.messages", async () => {
      mockFetch((url) => {
        if (url.endsWith("/threads")) {
          return jsonResponse({ thread_id: "thread-1" });
        }
        if (url.includes("/runs/wait")) {
          return jsonResponse({
            values: {
              messages: [
                { type: "human", content: "Hello" },
                { type: "ai", content: "Hi from LangGraph!" },
              ],
            },
          });
        }
        return new Response("Not Found", { status: 404 });
      });

      const client = new LangGraphClient("http://localhost:3000");
      await client.connect();
      const response = await client.send("Hello");

      expect(response).toBe("Hi from LangGraph!");
    });

    it("should extract AI messages from output.messages", async () => {
      mockFetch((url) => {
        if (url.endsWith("/threads")) {
          return jsonResponse({ thread_id: "thread-1" });
        }
        if (url.includes("/runs/wait")) {
          return jsonResponse({
            output: {
              messages: [{ role: "ai", content: "Output response" }],
            },
          });
        }
        return new Response("Not Found", { status: 404 });
      });

      const client = new LangGraphClient("http://localhost:3000");
      await client.connect();
      const response = await client.send("Hello");

      expect(response).toBe("Output response");
    });

    it("should extract AI messages from top-level messages", async () => {
      mockFetch((url) => {
        if (url.endsWith("/threads")) {
          return jsonResponse({ thread_id: "thread-1" });
        }
        if (url.includes("/runs/wait")) {
          return jsonResponse({
            messages: [{ type: "ai", content: "Top-level response" }],
          });
        }
        return new Response("Not Found", { status: 404 });
      });

      const client = new LangGraphClient("http://localhost:3000");
      await client.connect();
      const response = await client.send("Hello");

      expect(response).toBe("Top-level response");
    });

    it("should return empty response when no AI messages", async () => {
      mockFetch((url) => {
        if (url.endsWith("/threads")) {
          return jsonResponse({ thread_id: "thread-1" });
        }
        if (url.includes("/runs/wait")) {
          return jsonResponse({ values: { messages: [] } });
        }
        return new Response("Not Found", { status: 404 });
      });

      const client = new LangGraphClient("http://localhost:3000");
      await client.connect();
      const response = await client.send("Hello");

      expect(response).toBe("(empty response)");
    });

    it("should filter out human messages", async () => {
      mockFetch((url) => {
        if (url.endsWith("/threads")) {
          return jsonResponse({ thread_id: "thread-1" });
        }
        if (url.includes("/runs/wait")) {
          return jsonResponse({
            values: {
              messages: [
                { type: "human", content: "user input" },
                { type: "ai", content: "agent reply" },
              ],
            },
          });
        }
        return new Response("Not Found", { status: 404 });
      });

      const client = new LangGraphClient("http://localhost:3000");
      await client.connect();
      const response = await client.send("Hello");

      expect(response).toBe("agent reply");
      expect(response).not.toContain("user input");
    });

    it("should send correct request body", async () => {
      let capturedBody: Record<string, unknown> | undefined;
      mockFetch((url, init) => {
        if (url.endsWith("/threads")) {
          return jsonResponse({ thread_id: "thread-1" });
        }
        if (url.includes("/runs/wait")) {
          capturedBody = JSON.parse(init?.body as string);
          return jsonResponse({
            values: {
              messages: [{ type: "ai", content: "ok" }],
            },
          });
        }
        return new Response("Not Found", { status: 404 });
      });

      const client = new LangGraphClient("http://localhost:3000");
      await client.connect();
      await client.send("test message");

      expect(capturedBody).toBeDefined();
      expect(capturedBody!.assistant_id).toBe("default");
      expect(
        ((capturedBody!.input as Record<string, unknown>).messages as Array<Record<string, unknown>>)[0],
      ).toEqual({ role: "human", content: "test message" });
    });

    it("should use the correct thread URL", async () => {
      let runUrl: string | undefined;
      mockFetch((url) => {
        if (url.endsWith("/threads")) {
          return jsonResponse({ thread_id: "my-thread-id" });
        }
        if (url.includes("/runs/wait")) {
          runUrl = url;
          return jsonResponse({
            values: { messages: [{ type: "ai", content: "ok" }] },
          });
        }
        return new Response("Not Found", { status: 404 });
      });

      const client = new LangGraphClient("http://localhost:3000");
      await client.connect();
      await client.send("Hello");

      expect(runUrl).toBe(
        "http://localhost:3000/threads/my-thread-id/runs/wait",
      );
    });

    it("should throw AgentRequestError on non-200 run response", async () => {
      mockFetch((url) => {
        if (url.endsWith("/threads")) {
          return jsonResponse({ thread_id: "thread-1" });
        }
        return new Response("Bad Request", { status: 400 });
      });

      const client = new LangGraphClient("http://localhost:3000");
      await client.connect();

      await expect(client.send("Hello")).rejects.toThrow(AgentRequestError);
    });
  });
});
