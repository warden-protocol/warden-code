export type ProtocolKind = "a2a" | "langgraph";

export interface AgentInfo {
  protocol: ProtocolKind;
  name: string;
  description?: string;
  capabilities?: string[];
  url: string;
}

export interface ProbeResult {
  a2a: AgentInfo | null;
  langgraph: AgentInfo | null;
}

export interface AgentClient {
  connect(): Promise<void>;
  send(message: string): Promise<string>;
  readonly protocol: ProtocolKind;
}

// ── A2A wire types ──────────────────────────────────────────────

export interface A2AAgentCard {
  name: string;
  description?: string;
  url: string;
  capabilities?: {
    streaming?: boolean;
  };
  skills?: Array<{
    id: string;
    name: string;
    description?: string;
  }>;
}

export interface A2APart {
  kind: "text";
  text: string;
}

export interface A2AMessage {
  role: "user" | "agent";
  parts: A2APart[];
  messageId: string;
  contextId?: string;
}

export interface A2AJsonRpcRequest {
  jsonrpc: "2.0";
  id: string;
  method: "message/send";
  params: {
    message: A2AMessage;
  };
}

export interface A2AJsonRpcResponse {
  jsonrpc: "2.0";
  id: string;
  result?: {
    context_id?: string;
    history?: Array<{
      role: "user" | "agent";
      parts: A2APart[];
    }>;
    artifacts?: Array<{
      parts: A2APart[];
    }>;
  };
  error?: {
    code: number;
    message: string;
  };
}

// ── LangGraph wire types ────────────────────────────────────────

export interface LangGraphThread {
  thread_id: string;
}

export interface LangGraphMessage {
  type?: "human" | "ai";
  role?: "human" | "ai";
  content: string;
}

export interface LangGraphRunRequest {
  assistant_id: string;
  input: {
    messages: Array<{ role: "human"; content: string }>;
  };
}

export interface LangGraphRunResponse {
  values?: {
    messages?: LangGraphMessage[];
  };
  output?: {
    messages?: LangGraphMessage[];
  };
  messages?: LangGraphMessage[];
}
