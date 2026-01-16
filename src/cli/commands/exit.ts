import type { SlashCommand } from "../types.js";

export const exitCommand: SlashCommand = {
  name: "exit",
  description: "Exit the CLI",
  aliases: ["quit", "q"],
  handler: async () => {
    console.log();
    console.log("Goodbye!");
    process.exit(0);
  },
};
