import { exec } from "node:child_process";
import * as readline from "node:readline";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { promisify } from "node:util";
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
  applyChanges,
  SYSTEM_PROMPT,
  type FileChange,
} from "../services/ai/context.js";
import { StreamParser, type StreamEvent } from "../services/ai/stream-parser.js";
import { runChatSession } from "./chat.js";

const execAsync = promisify(exec);

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
      description: "Frontier coding model with strong reasoning",
    },
    {
      value: "custom",
      name: "Other",
      description: "Enter a model name manually (e.g. o3, gpt-4.1)",
    },
  ],
  anthropic: [
    {
      value: "claude-opus-4-6",
      name: "Claude Opus 4.6",
      description: "Most intelligent, best for complex coding and reasoning",
    },
    {
      value: "claude-sonnet-4-5-20250929",
      name: "Claude Sonnet 4.5",
      description: "Fast and capable, great balance of speed and quality",
    },
    {
      value: "custom",
      name: "Other",
      description: "Enter a model name manually",
    },
  ],
} as const;

async function setupWizard(currentConfig?: BuildConfig | null): Promise<BuildConfig> {
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
        description: "GPT-5.2 Codex",
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

  // Reuse existing API key when the provider hasn't changed
  let apiKey: string;
  if (currentConfig && currentConfig.provider === provider) {
    apiKey = currentConfig.apiKey;
  } else {
    apiKey = await password({
      message: `Enter your ${provider === "openai" ? "OpenAI" : "Anthropic"} API key:`,
      theme: promptTheme,
    });
  }

  const config: BuildConfig = { provider, model, apiKey };
  await writeConfig(config);
  return config;
}

function chatPrompt(): string {
  return chalk.rgb(199, 255, 142)("build") + chalk.dim("> ");
}

async function rebuildProject(
  projectDir: string,
  changedFiles: string[],
): Promise<string | null> {
  if (changedFiles.some((f) => f === "package.json")) {
    const installSpinner = ora({
      text: "Installing dependencies...",
      discardStdin: false,
    }).start();
    try {
      await execAsync("npm install", { cwd: projectDir });
      installSpinner.succeed("Dependencies installed!");
    } catch (error) {
      installSpinner.fail("Install failed");
      const err = error as { stderr?: string; stdout?: string };
      return err.stderr || err.stdout || "npm install failed";
    }
  }

  const buildSpinner = ora({
    text: "Building project...",
    discardStdin: false,
  }).start();
  try {
    await execAsync("npm run build", { cwd: projectDir });
    buildSpinner.succeed("Build succeeded!");
    return null;
  } catch (error) {
    buildSpinner.fail("Build failed");
    const err = error as { stderr?: string; stdout?: string };
    return err.stderr || err.stdout || "Build failed";
  }
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
    let config = await readConfig();
    if (!config) {
      try {
        config = await setupWizard();
        console.log();
        context.log.success("Configuration saved to ~/.warden/config.json");
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
    let provider = createProvider(config);

    console.log();
    console.log(chalk.bold("Build Mode") + chalk.dim(` (${config.model})`));
    console.log(
      chalk.dim(
        "Describe what you want your agent to do and the AI will edit your code.\n" +
          "Commands: /model, /rebuild, /chat, /exit\n",
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
        // Clear both the visual terminal line and readline's internal
        // buffer so stale text from prior input (confused by ora's
        // ANSI writes or paste remnants) never leaks into the prompt.
        readline.clearLine(process.stdout, 0);
        readline.cursorTo(process.stdout, 0);
        (rl as unknown as { line: string }).line = "";
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

      // ── /model sub-command ─────────────────────────────────
      if (trimmed === "/model") {
        rl.close();
        try {
          config = await setupWizard(config);
          provider = createProvider(config);
          messages.length = 0;
          console.log();
          context.log.success(`Switched to ${config.model}`);
          console.log();
        } catch (error) {
          if (error instanceof Error && error.name === "ExitPromptError") {
            console.log();
            context.log.dim("Cancelled.");
            console.log();
          } else {
            throw error;
          }
        }
        rl = createRl();
        continue;
      }

      // ── /rebuild sub-command ────────────────────────────────
      if (trimmed === "/rebuild") {
        console.log();
        await rebuildProject(projectDir, ["package.json"]);
        console.log();
        continue;
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
      let firstToken = true;
      const parser = new StreamParser();
      const fileChanges: FileChange[] = [];

      const handleEvent = (event: StreamEvent, changes: FileChange[]): void => {
        switch (event.type) {
          case "text":
            process.stdout.write(event.content);
            break;
          case "file_start":
            console.log();
            process.stdout.write(
              chalk.dim(`  Generating ${event.filePath}...`),
            );
            break;
          case "file_end":
            readline.clearLine(process.stdout, 0);
            readline.cursorTo(process.stdout, 0);
            changes.push({
              filePath: event.filePath,
              content: event.content,
            });
            break;
        }
      };

      try {
        for await (const delta of provider.chatStream(messages)) {
          if (firstToken) {
            spinner.stop();
            console.log();
            firstToken = false;
          }
          for (const event of parser.feed(delta)) {
            handleEvent(event, fileChanges);
          }
        }

        // Flush remaining parser state
        for (const event of parser.flush()) {
          handleEvent(event, fileChanges);
        }

        // Apply file changes to disk
        if (fileChanges.length > 0) {
          console.log();
          const applied = await applyChanges(projectDir, fileChanges);
          for (const file of applied) {
            context.log.success(`Updated ${file}`);
          }
          console.log();

          messages.push({
            role: "assistant",
            content: parser.getFullResponse(),
          });

          // Rebuild project; on failure, ask the AI to fix (up to 2 retries)
          let buildError = await rebuildProject(projectDir, applied);
          let retries = 0;
          const MAX_BUILD_RETRIES = 2;

          while (buildError && retries < MAX_BUILD_RETRIES) {
            retries++;
            console.log();
            messages.push({
              role: "user",
              content: `The build failed with these errors. Please fix them:\n\n${buildError}`,
            });

            const fixSpinner = ora({
              text: "Fixing build errors...",
              discardStdin: false,
            }).start();
            let fixFirstToken = true;
            const fixParser = new StreamParser();
            const fixChanges: FileChange[] = [];

            for await (const delta of provider.chatStream(messages)) {
              if (fixFirstToken) {
                fixSpinner.stop();
                console.log();
                fixFirstToken = false;
              }
              for (const event of fixParser.feed(delta)) {
                handleEvent(event, fixChanges);
              }
            }
            for (const event of fixParser.flush()) {
              handleEvent(event, fixChanges);
            }

            if (fixChanges.length > 0) {
              console.log();
              const fixApplied = await applyChanges(projectDir, fixChanges);
              for (const file of fixApplied) {
                context.log.success(`Updated ${file}`);
              }
              console.log();
            }

            messages.push({
              role: "assistant",
              content: fixParser.getFullResponse(),
            });

            const allChanged = [
              ...new Set([
                ...applied,
                ...fixChanges.map((c) => c.filePath),
              ]),
            ];
            buildError = await rebuildProject(projectDir, allChanged);
          }

          if (buildError) {
            context.log.error(
              "Build still failing after retries. Check the errors above.",
            );
          }
        } else {
          messages.push({
            role: "assistant",
            content: parser.getFullResponse(),
          });
        }

        console.log();
      } catch (error) {
        if (firstToken) {
          spinner.fail("Request failed");
        }
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
