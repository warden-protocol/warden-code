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

function validateAgentName(value: string): string | boolean {
  if (!value) return "Agent name is required";
  if (!/^[a-z][a-z0-9-]*$/.test(value)) {
    return "Name must be lowercase, start with a letter, and contain only letters, numbers, and hyphens";
  }
  return true;
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
        });
        if (!proceed) {
          return;
        }
      }

      // Gather agent configuration
      const name = await input({
        message: "Agent name:",
        validate: validateAgentName,
      });

      const description = await input({
        message: "Agent description:",
        default: `A helpful AI agent named ${name}`,
      });

      const template = await select({
        message: "Select a template:",
        choices: [
          {
            value: "blank" as const,
            name: "Blank",
            description: "Minimal A2A server that echoes input",
          },
          {
            value: "openai" as const,
            name: "OpenAI",
            description: "Full-featured agent with OpenAI/GPT integration",
          },
        ],
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
      });

      // Skills configuration
      const skills: AgentSkill[] = [];
      const addSkills = await confirm({
        message: "Would you like to define skills?",
        default: true,
      });

      if (addSkills) {
        let addingSkills = true;
        while (addingSkills) {
          const skillId = await input({
            message: "Skill ID (e.g., general-assistant):",
            validate: (v) => !!v || "Skill ID is required",
          });

          const skillName = await input({
            message: "Skill name:",
            default: skillId
              .split("-")
              .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
              .join(" "),
          });

          const skillDescription = await input({
            message: "Skill description:",
            default: `${skillName} capability`,
          });

          skills.push({
            id: skillId,
            name: skillName,
            description: skillDescription,
          });

          addingSkills = await confirm({
            message: "Add another skill?",
            default: false,
          });
        }
      }

      // Build config
      const config: AgentConfig = {
        name,
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
      console.log(`  Name:         ${chalk.cyan(config.name)}`);
      console.log(`  Description:  ${chalk.dim(config.description)}`);
      console.log(`  Template:     ${chalk.cyan(config.template)}`);
      console.log(
        `  Streaming:    ${config.capabilities.streaming ? chalk.green("Yes") : chalk.dim("No")}`,
      );
      console.log(
        `  Multi-turn:   ${config.capabilities.multiTurn ? chalk.green("Yes") : chalk.dim("No")}`,
      );
      console.log(
        `  Skills:       ${config.skills.length > 0 ? config.skills.map((s) => s.name).join(", ") : chalk.dim("None")}`,
      );
      console.log(chalk.dim("─".repeat(40)));
      console.log();

      const confirmed = await confirm({
        message: "Generate agent with this configuration?",
        default: true,
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
        context.log.success(
          `Created ${targetPath ? targetPath + "/" : ""}src/agent.ts`,
        );
        console.log();
        context.log.dim("Next steps (in a new terminal):");
        if (targetPath) {
          context.log.dim(`  cd ${targetPath}`);
        }
        context.log.dim("  pnpm install");
        context.log.dim("  pnpm build");
        context.log.dim("  pnpm agent");
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
