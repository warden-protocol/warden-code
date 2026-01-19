import type { SlashCommand, CliContext } from "../types.js";

export class CommandRegistry {
  private commands: Map<string, SlashCommand> = new Map();
  private aliases: Map<string, string> = new Map();

  register(command: SlashCommand): void {
    this.commands.set(command.name, command);
    if (command.aliases) {
      for (const alias of command.aliases) {
        this.aliases.set(alias, command.name);
      }
    }
  }

  get(name: string): SlashCommand | undefined {
    const resolvedName = this.aliases.get(name) ?? name;
    return this.commands.get(resolvedName);
  }

  has(name: string): boolean {
    return this.commands.has(name) || this.aliases.has(name);
  }

  all(): SlashCommand[] {
    return Array.from(this.commands.values()).sort(
      (a, b) => (a.order ?? 100) - (b.order ?? 100),
    );
  }

  async execute(input: string, context: CliContext): Promise<boolean> {
    const parsed = this.parseInput(input);
    if (!parsed) {
      return false;
    }

    const { commandName, args } = parsed;
    const command = this.get(commandName);

    if (!command) {
      context.log.error(`Unknown command: /${commandName}`);
      context.log.dim("Type /help to see available commands");
      return true;
    }

    await command.handler(args, context);
    return true;
  }

  private parseInput(
    input: string,
  ): { commandName: string; args: string[] } | null {
    const trimmed = input.trim();
    if (!trimmed.startsWith("/")) {
      return null;
    }

    const parts = trimmed.slice(1).split(/\s+/);
    const commandName = parts[0]?.toLowerCase();
    if (!commandName) {
      return null;
    }

    return {
      commandName,
      args: parts.slice(1),
    };
  }
}
