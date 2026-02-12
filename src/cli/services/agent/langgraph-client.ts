import type {
  AgentClient,
  LangGraphThread,
  LangGraphRunRequest,
  LangGraphRunResponse,
} from "./types.js";
import { AgentRequestError } from "./a2a-client.js";

export class LangGraphClient implements AgentClient {
  readonly protocol = "langgraph" as const;
  private threadId: string | undefined;

  constructor(private readonly baseUrl: string) {}

  async connect(): Promise<void> {
    const res = await fetch(`${this.baseUrl}/threads`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    if (!res.ok) {
      throw new AgentRequestError(res.status, await res.text());
    }

    const thread = (await res.json()) as LangGraphThread;
    this.threadId = thread.thread_id;
  }

  async send(message: string): Promise<string> {
    if (!this.threadId) {
      throw new Error("Not connected. Call connect() first.");
    }

    const body: LangGraphRunRequest = {
      assistant_id: "default",
      input: {
        messages: [{ role: "human", content: message }],
      },
    };

    const res = await fetch(
      `${this.baseUrl}/threads/${this.threadId}/runs/wait`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
    );

    if (!res.ok) {
      throw new AgentRequestError(res.status, await res.text());
    }

    const json = (await res.json()) as LangGraphRunResponse;

    // Try values.messages (actual), then output.messages, then top-level
    const messages =
      json.values?.messages ?? json.output?.messages ?? json.messages ?? [];

    // Messages use "type" (actual) or "role" to indicate the sender
    const aiMessages = messages.filter(
      (m) => m.type === "ai" || m.role === "ai",
    );

    if (aiMessages.length === 0) {
      return "(empty response)";
    }

    return aiMessages.map((m) => m.content).join("\n");
  }
}
