import { describe, it, expect, vi, afterEach } from "vitest";
import { A2AClient, AgentRequestError, AgentProtocolError } from "./a2a-client.js";

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

describe("A2AClient", () => {
  describe("send", () => {
    it("should extract agent text from history", async () => {
      mockFetch(() =>
        jsonResponse({
          jsonrpc: "2.0",
          id: "msg-1",
          result: {
            context_id: "ctx-1",
            history: [
              { role: "user", parts: [{ kind: "text", text: "Hello" }] },
              { role: "agent", parts: [{ kind: "text", text: "Hi there!" }] },
            ],
          },
        }),
      );

      const client = new A2AClient("http://localhost:3000");
      const response = await client.send("Hello");

      expect(response).toBe("Hi there!");
    });

    it("should extract text from artifacts as fallback", async () => {
      mockFetch(() =>
        jsonResponse({
          jsonrpc: "2.0",
          id: "msg-1",
          result: {
            artifacts: [
              { parts: [{ kind: "text", text: "Artifact response" }] },
            ],
          },
        }),
      );

      const client = new A2AClient("http://localhost:3000");
      const response = await client.send("Hello");

      expect(response).toBe("Artifact response");
    });

    it("should return empty response when no text found", async () => {
      mockFetch(() =>
        jsonResponse({
          jsonrpc: "2.0",
          id: "msg-1",
          result: {},
        }),
      );

      const client = new A2AClient("http://localhost:3000");
      const response = await client.send("Hello");

      expect(response).toBe("(empty response)");
    });

    it("should persist context_id across messages", async () => {
      let requestCount = 0;
      mockFetch((_url, init) => {
        requestCount++;
        const body = JSON.parse(init?.body as string);

        if (requestCount === 1) {
          expect(body.params.message.contextId).toBeUndefined();
        } else {
          expect(body.params.message.contextId).toBe("ctx-123");
        }

        return jsonResponse({
          jsonrpc: "2.0",
          id: body.id,
          result: {
            context_id: "ctx-123",
            history: [
              { role: "agent", parts: [{ kind: "text", text: "reply" }] },
            ],
          },
        });
      });

      const client = new A2AClient("http://localhost:3000");
      await client.send("first");
      await client.send("second");

      expect(requestCount).toBe(2);
    });

    it("should send correct JSON-RPC structure", async () => {
      let capturedBody: Record<string, unknown> | undefined;
      mockFetch((_url, init) => {
        capturedBody = JSON.parse(init?.body as string);
        return jsonResponse({
          jsonrpc: "2.0",
          id: "test",
          result: {
            history: [
              { role: "agent", parts: [{ kind: "text", text: "ok" }] },
            ],
          },
        });
      });

      const client = new A2AClient("http://localhost:3000");
      await client.send("test message");

      expect(capturedBody).toBeDefined();
      expect(capturedBody!.jsonrpc).toBe("2.0");
      expect(capturedBody!.method).toBe("message/send");
      expect((capturedBody!.params as Record<string, unknown>).message).toBeDefined();
    });

    it("should throw AgentRequestError on non-200 response", async () => {
      mockFetch(() => new Response("Server Error", { status: 500 }));

      const client = new A2AClient("http://localhost:3000");

      await expect(client.send("Hello")).rejects.toThrow(AgentRequestError);
    });

    it("should throw AgentProtocolError on JSON-RPC error", async () => {
      mockFetch(() =>
        jsonResponse({
          jsonrpc: "2.0",
          id: "msg-1",
          error: { code: -32600, message: "Invalid Request" },
        }),
      );

      const client = new A2AClient("http://localhost:3000");

      await expect(client.send("Hello")).rejects.toThrow(AgentProtocolError);
    });

    it("should join multiple agent messages", async () => {
      mockFetch(() =>
        jsonResponse({
          jsonrpc: "2.0",
          id: "msg-1",
          result: {
            history: [
              { role: "agent", parts: [{ kind: "text", text: "Line 1" }] },
              { role: "agent", parts: [{ kind: "text", text: "Line 2" }] },
            ],
          },
        }),
      );

      const client = new A2AClient("http://localhost:3000");
      const response = await client.send("Hello");

      expect(response).toBe("Line 1\nLine 2");
    });
  });
});

describe("AgentRequestError", () => {
  it("should store status and body", () => {
    const err = new AgentRequestError(404, "Not Found");
    expect(err.status).toBe(404);
    expect(err.body).toBe("Not Found");
    expect(err.name).toBe("AgentRequestError");
  });
});

describe("AgentProtocolError", () => {
  it("should store code and detail", () => {
    const err = new AgentProtocolError(-32600, "Invalid Request");
    expect(err.code).toBe(-32600);
    expect(err.detail).toBe("Invalid Request");
    expect(err.name).toBe("AgentProtocolError");
  });
});
