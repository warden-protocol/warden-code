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

      const provider = await select({
        message: "Select a provider:",
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
      if (provider === "openai") {
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
            value: "standard" as const,
            name: "Standard",
            description:
              "Response arrives all at once after completion. Simpler to work with",
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
      console.log(
        chalk.dim(
          "x402 lets your agent charge per request using USDC.\n" +
            "Supports Base (EVM) networks.\n" +
            "Clients pay automatically via the x402 protocol (HTTP 402).",
        ),
      );
      const enableX402 = await confirm({
        message: "Enable x402 payments?",
        default: false,
        theme: promptTheme,
      });

      if (enableX402) {
        const x402Accepts: Array<{
          network: string;
          payTo: string;
          price: string;
        }> = [];
        let addingNetworks = true;

        while (addingNetworks) {
          const network = await select({
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
                description: "Real USDC; uses the PayAI facilitator",
              },
            ],
            theme: promptTheme,
          });

          const payTo = await input({
            message: "EVM wallet address to receive payments (0x...):",
            validate: (v) => {
              const trimmed = v.trim();
              return (
                /^0x[a-fA-F0-9]{40}$/.test(trimmed) ||
                "Enter a valid Ethereum address (0x followed by 40 hex characters)"
              );
            },
            theme: promptTheme,
          });

          const price = await input({
            message: "Price per request (USDC):",
            default: "0.01",
            theme: promptTheme,
          });

          const isMainnet = network === "eip155:8453";
          if (isMainnet) {
            console.log(
              chalk.dim(
                "\nMainnet uses the PayAI facilitator (configured automatically).\n" +
                  "See: https://payai.network\n",
              ),
            );
          }

          x402Accepts.push({ network, payTo: payTo.trim(), price });

          addingNetworks = await confirm({
            message: "Add another payment network?",
            default: false,
            theme: promptTheme,
          });
        }

        x402Config = { accepts: x402Accepts };
      }

      // Build config
      const packageName = toPackageName(name);
      const config: AgentConfig = {
        name,
        packageName,
        description,
        provider,
        capabilities: {
          streaming: capability === "streaming",
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
        `  Provider:     ${chalk.rgb(199, 255, 142)(config.provider)}`,
      );
      console.log(
        `  Streaming:    ${config.capabilities.streaming ? chalk.rgb(199, 255, 142)("Yes") : chalk.dim("No")}`,
      );
      console.log(
        `  Skills:       ${config.skills.length > 0 ? chalk.rgb(199, 255, 142)(config.skills.map((s) => s.name).join(", ")) : chalk.dim("None")}`,
      );
      if (config.x402) {
        console.log(
          `  x402:         ${chalk.rgb(199, 255, 142)(`${config.x402.accepts.length} network(s)`)}`,
        );
        for (const a of config.x402.accepts) {
          console.log(
            `                ${chalk.dim(`${a.network}: ${a.price} USDC`)}`,
          );
        }
      } else {
        console.log(`  x402:         ${chalk.dim("Not configured (enable via /config)")}`);
      }
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
        if (config.x402) {
          const networkPrefixMap: Record<string, string> = {
            "eip155:84532": "X402_BASE_SEPOLIA",
            "eip155:8453": "X402_BASE",
          };
          const mainnetIds = new Set(["eip155:8453"]);
          const hasMainnet = config.x402.accepts.some((a) =>
            mainnetIds.has(a.network),
          );
          const facilitatorUrl = hasMainnet
            ? "https://facilitator.payai.network"
            : "https://x402.org/facilitator";
          envLines.push(`X402_FACILITATOR_URL=${facilitatorUrl}`);
          for (const a of config.x402.accepts) {
            const prefix = networkPrefixMap[a.network] || a.network;
            envLines.push(
              `${prefix}_PAY_TO=${a.payTo}`,
              `${prefix}_PRICE=${a.price}`,
              `${prefix}_NETWORK=${a.network}`,
            );
          }
          if (hasMainnet) {
            envLines.push("# PAYAI_API_KEY_ID=", "# PAYAI_API_KEY_SECRET=");
          }
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
