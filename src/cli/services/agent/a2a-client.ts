import type {
  AgentClient,
  A2AJsonRpcRequest,
  A2AJsonRpcResponse,
} from "./types.js";

export class AgentRequestError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: string,
  ) {
    super(`Agent returned HTTP ${status}`);
    this.name = "AgentRequestError";
  }
}

export class AgentProtocolError extends Error {
  constructor(
    public readonly code: number,
    public readonly detail: string,
  ) {
    super(`Agent protocol error ${code}: ${detail}`);
    this.name = "AgentProtocolError";
  }
}

export class A2AClient implements AgentClient {
  readonly protocol = "a2a" as const;
  private contextId: string | undefined;
  private messageCounter = 0;

  constructor(private readonly baseUrl: string) {}

  async connect(): Promise<void> {
    // A2A is stateless on connect; contextId is established on first response
  }

  async send(message: string): Promise<string> {
    const messageId = `msg-${++this.messageCounter}-${Date.now()}`;

    const body: A2AJsonRpcRequest = {
      jsonrpc: "2.0",
      id: messageId,
      method: "message/send",
      params: {
        message: {
          role: "user",
          parts: [{ kind: "text", text: message }],
          messageId,
          ...(this.contextId ? { contextId: this.contextId } : {}),
        },
      },
    };

    const res = await fetch(this.baseUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      throw new AgentRequestError(res.status, await res.text());
    }

    const json = (await res.json()) as A2AJsonRpcResponse;

    if (json.error) {
      throw new AgentProtocolError(json.error.code, json.error.message);
    }

    if (json.result?.context_id) {
      this.contextId = json.result.context_id;
    }

    // Extract agent text from history (preferred) or artifacts (fallback)
    const historyTexts = (json.result?.history ?? [])
      .filter((m) => m.role === "agent")
      .flatMap((m) => m.parts)
      .filter((p) => p.kind === "text")
      .map((p) => p.text);

    if (historyTexts.length > 0) {
      return historyTexts.join("\n");
    }

    const artifactTexts = (json.result?.artifacts ?? [])
      .flatMap((a) => a.parts)
      .filter((p) => p.kind === "text")
      .map((p) => p.text);

    return artifactTexts.join("\n") || "(empty response)";
  }
}
