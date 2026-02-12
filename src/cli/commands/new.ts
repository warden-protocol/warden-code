import { execSync } from "node:child_process";
import * as path from "node:path";
import { input, select, confirm, checkbox } from "@inquirer/prompts";
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
        message: "Select a model:",
        choices: [
          {
            value: "echo" as const,
            name: "Blank",
            description: "Minimal A2A server that echoes input",
          },
          {
            value: "openai" as const,
            name: "OpenAI",
            description: "Full-featured agent with OpenAI/GPT integration",
          },
        ],
        theme: promptTheme,
      });

      const capability = await select({
        message: "Select capability:",
        choices: [
          {
            value: "streaming" as const,
            name: "Streaming",
            description: "Stream responses as they are generated",
          },
          {
            value: "multiTurn" as const,
            name: "Multi-turn conversations",
            description: "Support back-and-forth conversations",
          },
        ],
        theme: promptTheme,
      });

      // Skills configuration
      const skills: AgentSkill[] = [];
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
        `  Model:        ${chalk.rgb(199, 255, 142)(config.template)}`,
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
        context.log.dim("Next steps:");
        context.log.dim(
          `  /build${targetPath ? ` ${targetPath}` : ""}  — enter AI chat mode to build your agent`,
        );
        console.log();
        context.log.dim("Or build and run manually (in a new terminal):");
        if (targetPath) {
          context.log.dim(`  cd ${targetPath}`);
        }
        context.log.dim("  npm run build");
        context.log.dim("  npm run agent");
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
