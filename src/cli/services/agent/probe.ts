import type { AgentInfo, ProbeResult, A2AAgentCard } from "./types.js";

const PROBE_TIMEOUT_MS = 5_000;

function isJsonResponse(res: Response): boolean {
  const ct = res.headers.get("content-type") ?? "";
  return ct.includes("application/json");
}

async function probeA2A(baseUrl: string): Promise<AgentInfo | null> {
  try {
    const res = await fetch(`${baseUrl}/.well-known/agent-card.json`, {
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
    });
    if (!res.ok || !isJsonResponse(res)) return null;
    const card = (await res.json()) as A2AAgentCard;
    if (!card.name) return null;
    return {
      protocol: "a2a",
      name: card.name,
      description: card.description,
      capabilities: [
        card.capabilities?.streaming ? "streaming" : "",
        ...(card.skills?.map((s) => s.name) ?? []),
      ].filter(Boolean),
      url: baseUrl,
    };
  } catch {
    return null;
  }
}

async function probeLangGraph(baseUrl: string): Promise<AgentInfo | null> {
  try {
    const infoRes = await fetch(`${baseUrl}/info`, {
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
    });
    if (!infoRes.ok || !isJsonResponse(infoRes)) return null;

    const info = (await infoRes.json()) as {
      name?: string;
      description?: string;
    };

    return {
      protocol: "langgraph",
      name: info.name || "LangGraph Agent",
      description: info.description,
      url: baseUrl,
    };
  } catch {
    return null;
  }
}

export async function probeAgent(baseUrl: string): Promise<ProbeResult> {
  const [a2a, langgraph] = await Promise.all([
    probeA2A(baseUrl),
    probeLangGraph(baseUrl),
  ]);
  return { a2a, langgraph };
}
