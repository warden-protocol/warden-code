import type { Ora } from "ora";

export interface SlashCommand {
  name: string;
  description: string;
  aliases?: string[];
  usage?: string;
  handler: (args: string[], context: CliContext) => Promise<void>;
}

export interface Logger {
  info: (msg: string) => void;
  success: (msg: string) => void;
  error: (msg: string) => void;
  warn: (msg: string) => void;
  dim: (msg: string) => void;
}

export interface CliContext {
  cwd: string;
  log: Logger;
  spinner: (msg: string) => Ora;
}

export interface AgentConfig {
  name: string;
  description: string;
  template: "blank" | "openai";
  capabilities: {
    streaming: boolean;
    multiTurn: boolean;
  };
  skills: AgentSkill[];
}

export interface AgentSkill {
  id: string;
  name: string;
  description: string;
}
