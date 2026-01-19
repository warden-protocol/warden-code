import chalk from "chalk";
import type { SlashCommand, CliContext } from "../types.js";
import { commandHelp } from "../ui/format.js";
import type { CommandRegistry } from "./registry.js";

export function createHelpCommand(registry: CommandRegistry): SlashCommand {
  return {
    name: "help",
    description: "Show available commands",
    aliases: ["h", "?"],
    usage: "/help [command]",
    order: 20,
    handler: async (args: string[], context: CliContext) => {
      if (args.length > 0) {
        const commandName = args[0];
        const command = registry.get(commandName);
        if (command) {
          console.log();
          console.log(chalk.bold(`/${command.name}`));
          console.log(chalk.dim(command.description));
          if (command.usage) {
            console.log();
            console.log(chalk.dim("Usage:"), command.usage);
          }
          if (command.aliases?.length) {
            console.log(
              chalk.dim("Aliases:"),
              command.aliases.map((a) => `/${a}`).join(", "),
            );
          }
          console.log();
        } else {
          context.log.error(`Unknown command: ${commandName}`);
        }
        return;
      }

      console.log();
      console.log(chalk.bold("Available Commands:"));
      console.log();
      for (const command of registry.all()) {
        console.log(commandHelp(command.name, command.description));
      }
      console.log();
      context.log.dim(
        "Type /help <command> for more info on a specific command",
      );
      console.log();
    },
  };
}
