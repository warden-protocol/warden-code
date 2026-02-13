import * as readline from "node:readline";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { select, password, input } from "@inquirer/prompts";
import chalk from "chalk";
import ora from "ora";
import type { SlashCommand, CliContext } from "../types.js";
import {
  readConfig,
  writeConfig,
  type BuildConfig,
} from "../services/config.js";
import {
  createProvider,
  formatAPIError,
  isNonRecoverableError,
  type Message,
} from "../services/ai/provider.js";
import {
  buildProjectContext,
  parseResponse,
  applyChanges,
  SYSTEM_PROMPT,
} from "../services/ai/context.js";
import { runChatSession } from "./chat.js";

const promptTheme = {
  style: {
    answer: (text: string) => chalk.rgb(199, 255, 142)(text),
    highlight: (text: string) => chalk.rgb(199, 255, 142)(text),
    description: (text: string) => chalk.rgb(199, 255, 142)(text),
  },
};

async function projectExists(cwd: string): Promise<boolean> {
  try {
    await fs.access(path.join(cwd, "src", "agent.ts"));
    return true;
  } catch {
    return false;
  }
}

export async function readAgentUrl(projectDir: string): Promise<string | null> {
  try {
    const envContent = await fs.readFile(
      path.join(projectDir, ".env"),
      "utf-8",
    );
    for (const line of envContent.split("\n")) {
      const trimmed = line.trim();
      if (trimmed.startsWith("AGENT_URL=")) {
        const value = trimmed.slice("AGENT_URL=".length).trim();
        if (value) return value;
      }
    }
    return null;
  } catch {
    return null;
  }
}

const MODEL_CHOICES = {
  openai: [
    {
      value: "gpt-5.2-codex",
      name: "GPT-5.2 Codex",
      description: "Latest — frontier coding with strong reasoning",
    },
    {
      value: "gpt-5.1-codex",
      name: "GPT-5.1 Codex",
      description: "Stable — great balance of speed and quality",
    },
    {
      value: "custom",
      name: "Other",
      description: "Enter a model name manually",
    },
  ],
  anthropic: [
    {
      value: "claude-opus-4-6",
      name: "Claude Opus 4.6",
      description: "Most intelligent — best for complex coding and reasoning",
    },
    {
      value: "claude-sonnet-4-5-20250929",
      name: "Claude Sonnet 4.5",
      description: "Fast and capable — great balance of speed and quality",
    },
    {
      value: "custom",
      name: "Other",
      description: "Enter a model name manually",
    },
  ],
} as const;

async function setupWizard(cwd: string): Promise<BuildConfig> {
  console.log();
  console.log(chalk.bold("Build Mode Setup"));
  console.log(
    chalk.dim(
      "Build mode uses an AI model to help you write your agent's code.\n" +
        "Choose a provider and model for the coding assistant (this is not your agent's AI).\n",
    ),
  );

  const provider = await select({
    message: "Select AI provider:",
    choices: [
      {
        value: "openai" as const,
        name: "OpenAI",
        description: "GPT-5.2 Codex, GPT-5.1 Codex",
      },
      {
        value: "anthropic" as const,
        name: "Anthropic",
        description: "Claude Opus 4.6, Claude Sonnet 4.5",
      },
    ],
    theme: promptTheme,
  });

  let model: string = await select({
    message: "Select model:",
    choices: MODEL_CHOICES[provider].map((c) => ({ ...c })),
    theme: promptTheme,
  });

  if (model === "custom") {
    model = await input({
      message: "Enter model name:",
      validate: (value) => (value.trim() ? true : "Model name is required"),
      theme: promptTheme,
    });
  }

  const apiKey = await password({
    message: `Enter your ${provider === "openai" ? "OpenAI" : "Anthropic"} API key:`,
    theme: promptTheme,
  });

  const config: BuildConfig = { provider, model, apiKey };
  await writeConfig(cwd, config);
  return config;
}

function chatPrompt(): string {
  return chalk.rgb(199, 255, 142)("build") + chalk.dim("> ");
}

export const buildCommand: SlashCommand = {
  name: "build",
  description: "Enter AI-powered chat mode to build your agent",
  usage: "/build [path]",
  order: 5,
  handler: async (args: string[], context: CliContext) => {
    // Resolve project directory from optional path argument
    const targetPath = args[0];
    const projectDir = targetPath
      ? path.resolve(context.cwd, targetPath)
      : context.cwd;

    // Check for scaffolded project
    const hasProject = await projectExists(projectDir);
    if (!hasProject) {
      context.log.error(
        targetPath
          ? `No agent project found in ${targetPath}. Run /new ${targetPath} to create one first.`
          : "No agent project found. Run /new to create one first.",
      );
      return;
    }

    // Get or create config
    let config = await readConfig(projectDir);
    if (!config) {
      try {
        config = await setupWizard(projectDir);
        console.log();
        context.log.success("Configuration saved to .warden/config.json");
      } catch (error) {
        if (error instanceof Error && error.name === "ExitPromptError") {
          console.log();
          context.log.dim("Cancelled.");
          return;
        }
        throw error;
      }
    }

    // Create provider
    const provider = createProvider(config);

    console.log();
    console.log(chalk.bold("Build Mode") + chalk.dim(` (${config.model})`));
    console.log(
      chalk.dim(
        "Describe what you want your agent to do and the AI will edit your code.\n" +
          "Type /chat to talk to your running agent, or /exit to leave.\n",
      ),
    );

    // Chat loop
    const messages: Message[] = [];
    let running = true;

    const createRl = () => {
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });
      rl.on("SIGINT", () => {
        running = false;
        rl.close();
        console.log();
        context.log.dim("Exited build mode.");
      });
      return rl;
    };

    const question = (
      rl: readline.Interface,
      prompt: string,
    ): Promise<string> =>
      new Promise((resolve, reject) => {
        const onClose = () => reject(new Error("closed"));
        rl.once("close", onClose);
        rl.question(prompt, (answer) => {
          rl.removeListener("close", onClose);
          resolve(answer);
        });
      });

    let rl = createRl();

    while (running) {
      let userInput: string;
      try {
        userInput = await question(rl, chatPrompt());
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
        context.log.dim("Exited build mode.");
        break;
      }

      // ── /chat sub-command ──────────────────────────────────
      if (trimmed === "/chat" || trimmed.startsWith("/chat ")) {
        const chatArg = trimmed.slice("/chat".length).trim();
        let chatUrl: string | null = chatArg || null;

        // Try to resolve URL from .env if not provided
        if (!chatUrl) {
          chatUrl = await readAgentUrl(projectDir);
          if (chatUrl) {
            context.log.dim(`Using AGENT_URL from .env: ${chatUrl}`);
          }
        }

        // Prompt for URL if still missing
        if (!chatUrl) {
          try {
            chatUrl = await question(rl, chalk.dim("Enter agent URL: "));
            chatUrl = chatUrl.trim();
          } catch {
            break;
          }
        }

        if (!chatUrl) {
          context.log.error("No URL provided.");
          console.log();
          continue;
        }

        const baseUrl = chatUrl.replace(/\/+$/, "");
        try {
          new URL(baseUrl);
        } catch {
          context.log.error(`Invalid URL: ${chatUrl}`);
          console.log();
          continue;
        }

        // Close build readline before entering chat session
        rl.close();

        context.log.dim(
          "Tip: make sure your agent is running (npm run agent) in another terminal.",
        );
        await runChatSession(baseUrl, context);

        // Return to build mode
        console.log();
        context.log.info("Back to build mode.");
        console.log();
        rl = createRl();
        continue;
      }

      // Build context from current project files
      const projectContext = await buildProjectContext(projectDir);

      // On first message, add system prompt with context
      if (messages.length === 0) {
        messages.push({
          role: "system",
          content: `${SYSTEM_PROMPT}\n\nCurrent project files:\n\n${projectContext}`,
        });
      } else {
        // Update system prompt with latest project state
        messages[0] = {
          role: "system",
          content: `${SYSTEM_PROMPT}\n\nCurrent project files:\n\n${projectContext}`,
        };
      }

      messages.push({ role: "user", content: trimmed });

      const spinner = ora({ text: "Thinking...", discardStdin: false }).start();

      try {
        const response = await provider.chat(messages);
        spinner.stop();

        const { text, changes } = parseResponse(response);

        // Apply file changes
        if (changes.length > 0) {
          const applied = await applyChanges(projectDir, changes);
          console.log();
          for (const file of applied) {
            context.log.success(`Updated ${file}`);
          }
        }

        // Show explanation
        if (text) {
          console.log();
          console.log(text);
        }

        console.log();
      } catch (error) {
        spinner.fail("Request failed");
        context.log.error(formatAPIError(error));
        if (isNonRecoverableError(error)) {
          rl.close();
          break;
        }
        console.log();
      }
    }
  },
};
