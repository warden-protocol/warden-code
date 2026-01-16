import chalk from "chalk";

export function banner(): string {
  return chalk.cyan(`
 __        __            _
 \\ \\      / /_ _ _ __ __| | ___ _ __
  \\ \\ /\\ / / _\` | '__/ _\` |/ _ \\ '_ \\
   \\ V  V / (_| | | | (_| |  __/ | | |
    \\_/\\_/ \\__,_|_|  \\__,_|\\___|_| |_|

`) + chalk.dim("  Agent Development CLI\n");
}

export function prompt(): string {
  return chalk.green("warden") + chalk.dim("> ");
}

export function commandHelp(name: string, description: string, usage?: string): string {
  let output = `  ${chalk.cyan("/" + name)}`;
  output += chalk.dim(` - ${description}`);
  if (usage) {
    output += `\n    ${chalk.dim("Usage:")} ${usage}`;
  }
  return output;
}
