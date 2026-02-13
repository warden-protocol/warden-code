import * as readline from "node:readline";
import { select } from "@inquirer/prompts";
import chalk from "chalk";
import ora from "ora";
import type { SlashCommand, CliContext } from "../types.js";
import type {
  AgentClient,
  AgentInfo,
  ProtocolKind,
} from "../services/agent/types.js";
import { probeAgent } from "../services/agent/probe.js";
import {
  A2AClient,
  AgentRequestError,
  AgentProtocolError,
} from "../services/agent/a2a-client.js";
import { LangGraphClient } from "../services/agent/langgraph-client.js";

function chatModePrompt(): string {
  return chalk.rgb(199, 255, 142)("chat") + chalk.dim("> ");
}

function createClient(protocol: ProtocolKind, baseUrl: string): AgentClient {
  switch (protocol) {
    case "a2a":
      return new A2AClient(baseUrl);
    case "langgraph":
      return new LangGraphClient(baseUrl);
  }
}

function displayAgentInfo(info: AgentInfo): void {
  console.log();
  console.log(
    chalk.bold(info.name) + chalk.dim(` (${info.protocol.toUpperCase()})`),
  );
  if (info.description) {
    console.log(chalk.dim(info.description));
  }
  if (info.capabilities && info.capabilities.length > 0) {
    console.log(chalk.dim("Capabilities: ") + info.capabilities.join(", "));
  }
}

function formatAgentError(error: unknown): string {
  if (error instanceof AgentRequestError) {
    const { status, body } = error;
    if (status === 404)
      return "Agent endpoint not found. Is the agent running?";
    if (status === 500) return `Agent internal error: ${body.slice(0, 200)}`;
    if (status === 502 || status === 503)
      return "Agent is unavailable. Try again shortly.";
    if (status === 408 || status === 504)
      return "Agent timed out. Try a simpler request.";
    return `Agent returned HTTP ${status}: ${body.slice(0, 200)}`;
  }
  if (error instanceof AgentProtocolError) {
    return `Protocol error (${error.code}): ${error.detail}`;
  }
  if (error instanceof TypeError && String(error.message).includes("fetch")) {
    return "Connection refused. Is the agent running?";
  }
  if (error instanceof Error && error.name === "TimeoutError") {
    return "Request timed out. The agent may be overloaded.";
  }
  return String(error);
}

function isNonRecoverableError(error: unknown): boolean {
  if (error instanceof TypeError && String(error.message).includes("fetch")) {
    return true;
  }
  return false;
}

/**
 * Runs an interactive chat session with an agent.
 * Probes the agent, connects, and enters a chat loop.
 * Returns when the user types /exit or Ctrl+C.
 */
export async function runChatSession(
  baseUrl: string,
  context: CliContext,
): Promise<void> {
  // ── Probe agent ────────────────────────────────────────────
  const spinner = ora({
    text: "Connecting to agent...",
    discardStdin: false,
  }).start();

  let probeResult;
  try {
    probeResult = await probeAgent(baseUrl);
  } catch {
    spinner.fail("Could not reach agent");
    context.log.error(`Connection failed. No agent is running at ${baseUrl}.`);
    console.log();
    context.log.dim("To start your agent, open a new terminal and run:");
    context.log.dim("  npm run build");
    context.log.dim("  npm run agent");
    console.log();
    context.log.dim("Once the agent is running, try /chat again.");
    return;
  }

  const available = [probeResult.a2a, probeResult.langgraph].filter(
    (info): info is AgentInfo => info !== null,
  );

  if (available.length === 0) {
    spinner.fail("No supported protocol detected");
    context.log.error(
      `The agent at ${baseUrl} does not appear to support A2A or LangGraph.`,
    );
    context.log.dim(
      "Checked: /.well-known/agent-card.json (A2A) and /info (LangGraph)",
    );
    return;
  }

  spinner.succeed("Agent detected");

  // ── Select protocol ────────────────────────────────────────
  let selectedInfo: AgentInfo;

  if (available.length === 1) {
    selectedInfo = available[0]!;
  } else {
    try {
      const protocol = await select<ProtocolKind>({
        message: "Select protocol:",
        choices: available.map((info) => ({
          value: info.protocol,
          name: info.protocol === "a2a" ? "A2A (Agent-to-Agent)" : "LangGraph",
          description: info.name,
        })),
        theme: {
          style: {
            answer: (text: string) => chalk.rgb(199, 255, 142)(text),
            highlight: (text: string) => chalk.rgb(199, 255, 142)(text),
            description: (text: string) => chalk.rgb(199, 255, 142)(text),
          },
        },
      });
      selectedInfo = available.find((i) => i.protocol === protocol)!;
    } catch (error) {
      if (error instanceof Error && error.name === "ExitPromptError") {
        console.log();
        context.log.dim("Cancelled.");
        return;
      }
      throw error;
    }
  }

  // ── Display agent info ─────────────────────────────────────
  displayAgentInfo(selectedInfo);

  // ── Connect ────────────────────────────────────────────────
  const client = createClient(selectedInfo.protocol, baseUrl);

  const connectSpinner = ora({
    text: "Starting session...",
    discardStdin: false,
  }).start();
  try {
    await client.connect();
    connectSpinner.succeed("Session started");
  } catch (error) {
    connectSpinner.fail("Failed to start session");
    context.log.error(formatAgentError(error));
    return;
  }

  console.log(chalk.dim("\nType your message. /exit to leave.\n"));

  // ── Chat loop ──────────────────────────────────────────────
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const question = (prompt: string): Promise<string> =>
    new Promise((resolve, reject) => {
      const onClose = () => reject(new Error("closed"));
      rl.once("close", onClose);
      rl.question(prompt, (answer) => {
        rl.removeListener("close", onClose);
        resolve(answer);
      });
    });

  let running = true;

  rl.on("SIGINT", () => {
    running = false;
    rl.close();
    console.log();
    context.log.dim("Exited chat mode.");
  });

  while (running) {
    let userInput: string;
    try {
      userInput = await question(chatModePrompt());
    } catch {
      break;
    }

    const trimmed = userInput.trim();

    if (!trimmed) {
      continue;
    }

    if (trimmed === "/exit") {
      rl.close();
      console.log();
      context.log.dim("Exited chat mode.");
      break;
    }

    const msgSpinner = ora({
      text: "Thinking...",
      discardStdin: false,
    }).start();

    try {
      const response = await client.send(trimmed);
      msgSpinner.stop();

      console.log();
      console.log(response);
      console.log();
    } catch (error) {
      msgSpinner.fail("Request failed");
      context.log.error(formatAgentError(error));
      if (isNonRecoverableError(error)) {
        rl.close();
        break;
      }
      console.log();
    }
  }
}

export const chatCommand: SlashCommand = {
  name: "chat",
  description: "Chat with a running agent via A2A or LangGraph",
  usage: "/chat <url>",
  order: 6,
  handler: async (args: string[], context: CliContext) => {
    const rawUrl = args[0];
    if (!rawUrl) {
      context.log.error("Missing agent URL. Usage: /chat <url>");
      context.log.dim("Example: /chat http://localhost:3000");
      return;
    }

    const baseUrl = rawUrl.replace(/\/+$/, "");

    try {
      new URL(baseUrl);
    } catch {
      context.log.error(`Invalid URL: ${rawUrl}`);
      return;
    }

    await runChatSession(baseUrl, context);
  },
};
