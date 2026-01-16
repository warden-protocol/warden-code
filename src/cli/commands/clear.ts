import type { SlashCommand } from "../types.js";

export const clearCommand: SlashCommand = {
  name: "clear",
  description: "Clear the terminal screen",
  aliases: ["cls"],
  handler: async () => {
    console.clear();
  },
};
