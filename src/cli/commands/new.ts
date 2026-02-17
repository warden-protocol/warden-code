import { exec } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);
import * as path from "node:path";
import { input, select, confirm, checkbox, password } from "@inquirer/prompts";
import chalk from "chalk";
import type {
  SlashCommand,
  CliContext,
  AgentConfig,
  AgentSkill,
} from "../types.js";
import {
  isDirectoryEmpty,
  createDirectory,
  directoryExists,
  writeFile,
} from "../services/project.js";
import { scaffoldAgent } from "../services/scaffolder.js";

const promptTheme = {
  style: {
    answer: (text: string) => chalk.rgb(199, 255, 142)(text),
    highlight: (text: string) => chalk.rgb(199, 255, 142)(text),
    description: (text: string) => chalk.rgb(199, 255, 142)(text),
  },
};

function validateAgentName(value: string): string | boolean {
  if (!value.trim()) return "Agent name is required";
  return true;
}

/**
 * Convert a display name to a valid npm package name.
 * e.g., "My Cool Agent" -> "my-cool-agent"
 */
function toPackageName(displayName: string): string {
  return displayName
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-\s]/g, "") // remove invalid chars
    .replace(/\s+/g, "-") // spaces to hyphens
    .replace(/-+/g, "-") // collapse multiple hyphens
    .replace(/^-|-$/g, ""); // trim leading/trailing hyphens
}

export const newCommand: SlashCommand = {
  name: "new",
  description: "Create a new agent interactively",
  usage: "/new [path]",
  order: 10,
  handler: async (args: string[], context: CliContext) => {
    try {
      // Determine target directory
      const targetPath = args[0];
      let targetDir = context.cwd;

      if (targetPath) {
        targetDir = path.resolve(context.cwd, targetPath);
        const exists = await directoryExists(targetDir);
        if (!exists) {
          await createDirectory(targetDir);
          context.log.success(`Created directory: ${targetPath}`);
        }
      }

      console.log();
      console.log(chalk.bold("Agent Scaffolding Wizard"));
      console.log(chalk.dim("Let's create your agent step by step.\n"));

      // Check if directory is empty
      const isEmpty = await isDirectoryEmpty(targetDir);
      if (!isEmpty) {
        context.log.warn("Target directory is not empty.");
        const proceed = await confirm({
          message: "Continue anyway?",
          default: false,
          theme: promptTheme,
        });
        if (!proceed) {
          return;
        }
      }

      // Gather agent configuration
      const name = await input({
        message: "Agent name:",
        validate: validateAgentName,
        theme: promptTheme,
      });

      const description = await input({
        message: "Agent description:",
        default: `A helpful AI agent named ${name}`,
        theme: promptTheme,
      });

      const template = await select({
        message: "Select a template:",
        choices: [
          {
            value: "echo" as const,
            name: "Blank",
            description:
              "A minimal A2A server with no AI model — echoes input back (good for testing)",
          },
          {
            value: "openai" as const,
            name: "OpenAI",
            description:
              "An AI-powered agent using OpenAI/GPT — can reason and respond to tasks",
          },
        ],
        theme: promptTheme,
      });

      let openaiApiKey: string | undefined;
      if (template === "openai") {
        openaiApiKey = await password({
          message: "Enter your OpenAI API key:",
          theme: promptTheme,
        });
      }

      const capability = await select({
        message: "Select a communication style for your agent:",
        choices: [
          {
            value: "streaming" as const,
            name: "Streaming",
            description:
              "Tokens stream in real-time as the model generates — faster perceived response",
          },
          {
            value: "multiTurn" as const,
            name: "Multi-turn conversations",
            description:
              "Response arrives all at once after completion — simpler to work with",
          },
        ],
        theme: promptTheme,
      });

      // Skills configuration
      const skills: AgentSkill[] = [];
      console.log(
        chalk.dim(
          'Skills describe what your agent can do (e.g. "summarize text", "translate").\n' +
            "They are advertised in the agent card so other agents and clients can discover capabilities.",
        ),
      );
      const addSkills = await confirm({
        message: "Would you like to define skills?",
        default: true,
        theme: promptTheme,
      });

      if (addSkills) {
        let addingSkills = true;
        while (addingSkills) {
          const skillId = await input({
            message: "Skill ID (e.g., general-assistant):",
            validate: (v) => !!v || "Skill ID is required",
            theme: promptTheme,
          });

          const skillName = await input({
            message: "Skill name:",
            default: skillId
              .split("-")
              .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
              .join(" "),
            theme: promptTheme,
          });

          const skillDescription = await input({
            message: "Skill description:",
            default: `${skillName} capability`,
            theme: promptTheme,
          });

          skills.push({
            id: skillId,
            name: skillName,
            description: skillDescription,
          });

          addingSkills = await confirm({
            message: "Add another skill?",
            default: false,
            theme: promptTheme,
          });
        }
      }

      // x402 payment configuration
      let x402Config: AgentConfig["x402"];
      let x402PayToAddress: string | undefined;
      console.log(
        chalk.dim(
          "x402 lets your agent charge per request using USDC on Base.\n" +
            "Clients pay automatically via the x402 protocol (HTTP 402).",
        ),
      );
      const enableX402 = await confirm({
        message: "Enable x402 payments?",
        default: false,
        theme: promptTheme,
      });

      if (enableX402) {
        x402PayToAddress = await input({
          message: "Wallet address to receive payments (0x...):",
          validate: (v) =>
            /^0x[a-fA-F0-9]{40}$/.test(v.trim()) ||
            "Enter a valid Ethereum address (0x followed by 40 hex characters)",
          theme: promptTheme,
        });

        const x402Price = await input({
          message: "Price per request (USDC):",
          default: "0.01",
          theme: promptTheme,
        });

        const x402Network = await select({
          message: "Payment network:",
          choices: [
            {
              value: "eip155:84532",
              name: "Base Sepolia (testnet)",
              description:
                "Free test USDC, uses the default x402.org facilitator",
            },
            {
              value: "eip155:8453",
              name: "Base (mainnet)",
              description:
                "Real USDC payments; requires Coinbase CDP facilitator and API keys",
            },
          ],
          theme: promptTheme,
        });

        if (x402Network === "eip155:8453") {
          console.log(
            chalk.dim(
              "\nBase mainnet requires the Coinbase CDP facilitator.\n" +
                "Set X402_FACILITATOR_URL=https://api.cdp.coinbase.com/platform/v2/x402 in .env\n" +
                "and configure CDP_API_KEY_ID / CDP_API_KEY_SECRET.\n" +
                "See: https://docs.cdp.coinbase.com/x402/quickstart-for-sellers\n",
            ),
          );
        }

        x402Config = { price: x402Price, network: x402Network };
      }

      // Build config
      const packageName = toPackageName(name);
      const config: AgentConfig = {
        name,
        packageName,
        description,
        template,
        capabilities: {
          streaming: capability === "streaming",
          multiTurn: capability === "multiTurn",
        },
        skills,
        x402: x402Config,
      };

      // Confirm and generate
      console.log();
      console.log(chalk.bold("Configuration Summary:"));
      console.log(chalk.dim("─".repeat(40)));
      console.log(`  Name:         ${chalk.rgb(199, 255, 142)(config.name)}`);
      console.log(
        `  Package:      ${chalk.rgb(199, 255, 142)(config.packageName)}`,
      );
      console.log(
        `  Description:  ${chalk.rgb(199, 255, 142)(config.description)}`,
      );
      console.log(
        `  Template:     ${chalk.rgb(199, 255, 142)(config.template)}`,
      );
      console.log(
        `  Streaming:    ${config.capabilities.streaming ? chalk.rgb(199, 255, 142)("Yes") : chalk.dim("No")}`,
      );
      console.log(
        `  Multi-turn:   ${config.capabilities.multiTurn ? chalk.rgb(199, 255, 142)("Yes") : chalk.dim("No")}`,
      );
      console.log(
        `  Skills:       ${config.skills.length > 0 ? chalk.rgb(199, 255, 142)(config.skills.map((s) => s.name).join(", ")) : chalk.dim("None")}`,
      );
      console.log(
        `  x402:         ${config.x402 ? chalk.rgb(199, 255, 142)(`$${config.x402.price} on ${config.x402.network}`) : chalk.dim("Disabled")}`,
      );
      console.log(chalk.dim("─".repeat(40)));
      console.log();

      const confirmed = await confirm({
        message: "Generate agent with this configuration?",
        default: true,
        theme: promptTheme,
      });

      if (!confirmed) {
        context.log.dim("Cancelled.");
        return;
      }

      const spinner = context.spinner("Generating agent...").start();

      try {
        await scaffoldAgent(targetDir, config);

        const envLines = [
          "HOST=localhost",
          "PORT=3000",
          "AGENT_URL=http://localhost:3000",
        ];
        if (openaiApiKey) {
          envLines.push(
            `OPENAI_API_KEY=${openaiApiKey}`,
            "OPENAI_MODEL=gpt-4o-mini",
          );
        }
        if (config.x402 && x402PayToAddress) {
          envLines.push(
            `X402_PAY_TO_ADDRESS=${x402PayToAddress}`,
            `X402_PRICE=${config.x402.price}`,
            `X402_NETWORK=${config.x402.network}`,
            "X402_FACILITATOR_URL=https://x402.org/facilitator",
          );
        }
        envLines.push("");
        await writeFile(path.join(targetDir, ".env"), envLines.join("\n"));

        spinner.succeed("Agent generated!");
        console.log();
        context.log.success(`Agent files created successfully.`);

        const installSpinner = context
          .spinner("Installing dependencies...")
          .start();
        try {
          await execAsync("npm install", { cwd: targetDir });
          installSpinner.succeed("Dependencies installed!");
        } catch {
          installSpinner.fail("Failed to install dependencies");
          context.log.dim("  Run npm install manually to install dependencies");
        }

        console.log();
        console.log(chalk.bold("What was created:"));
        context.log.dim(
          "  src/agent.ts    — your agent's logic (this is the main file you'll edit)",
        );
        context.log.dim(
          "  src/server.ts   — HTTP server that exposes your agent via A2A and LangGraph",
        );
        context.log.dim(
          "  agent-card.json — metadata other agents use to discover yours",
        );
        context.log.dim(
          "  .env            — environment variables (port, URL, API keys)",
        );
        console.log();
        console.log(chalk.bold("Next steps:"));
        context.log.dim(
          `  1. /build${targetPath ? ` ${targetPath}` : ""}  — enter AI chat mode to build your agent`,
        );
        context.log.dim(
          "     Then use /chat inside build mode to talk to your running agent",
        );
        console.log();
        context.log.dim("Or build and run manually (in a new terminal):");
        if (targetPath) {
          context.log.dim(`  cd ${targetPath}`);
        }
        context.log.dim("  npm run build   — compile TypeScript");
        context.log.dim(
          "  npm run agent   — start the agent on http://localhost:3000",
        );
        console.log();
      } catch (error) {
        spinner.fail("Failed to generate agent");
        context.log.error(String(error));
      }
    } catch (error) {
      // Handle Ctrl+C cancellation from Inquirer prompts
      if (error instanceof Error && error.name === "ExitPromptError") {
        console.log();
        context.log.dim("Cancelled.");
        return;
      }
      throw error;
    }
  },
};
