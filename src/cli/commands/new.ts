import { execSync } from "node:child_process";
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
        envLines.push("");
        await writeFile(path.join(targetDir, ".env"), envLines.join("\n"));

        spinner.succeed("Agent generated!");
        console.log();
        context.log.success(`Agent files created successfully.`);

        const installSpinner = context
          .spinner("Installing dependencies...")
          .start();
        try {
          execSync("npm install", { cwd: targetDir, stdio: "ignore" });
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
