#!/usr/bin/env node

import * as readline from "node:readline";
import { createContext } from "./context.js";
import {
  CommandRegistry,
  createHelpCommand,
  clearCommand,
  exitCommand,
  newCommand,
  buildCommand,
  chatCommand,
  configCommand,
  registerCommand,
  activateCommand,
  deactivateCommand,
} from "./commands/index.js";
import { banner, prompt } from "./ui/format.js";

async function main() {
  const context = createContext(process.cwd());
  const registry = new CommandRegistry();

  // Register commands
  registry.register(createHelpCommand(registry));
  registry.register(clearCommand);
  registry.register(exitCommand);
  registry.register(newCommand);
  registry.register(buildCommand);
  registry.register(chatCommand);
  registry.register(configCommand);
  registry.register(registerCommand);
  registry.register(activateCommand);
  registry.register(deactivateCommand);

  // Display welcome banner and available commands
  console.log(banner());
  await registry.execute("/help", context);

  const history: string[] = [];

  const createRl = () =>
    readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      history,
    });

  let rl = createRl();
  let pausedForCommand = false;

  const handleClose = () => {
    if (pausedForCommand) return;
    console.log("\nGoodbye!");
    process.exit(0);
  };

  rl.on("close", handleClose);

  const promptUser = () => {
    rl.question(prompt(), async (input) => {
      const trimmed = input.trim();

      if (!trimmed) {
        promptUser();
        return;
      }

      if (trimmed.startsWith("/")) {
        // Close readline before running command (Inquirer needs stdin)
        pausedForCommand = true;
        rl.close();
        await registry.execute(trimmed, context);
        // Recreate readline after command completes
        rl = createRl();
        pausedForCommand = false;
        rl.on("close", handleClose);
      } else {
        context.log.dim(
          "Commands start with /. Type /help for available commands.",
        );
      }

      promptUser();
    });
  };

  promptUser();
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
