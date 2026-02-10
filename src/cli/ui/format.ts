import { readFileSync } from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import chalk from "chalk";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(
  readFileSync(
    path.resolve(__dirname, "..", "..", "..", "package.json"),
    "utf-8",
  ),
);

export function banner(): string {
  return (
    chalk.rgb(
      199,
      255,
      142,
    )(`
░██       ░██    ░███    ░█████████  ░███████   ░██████████ ░███    ░██
░██       ░██   ░██░██   ░██     ░██ ░██   ░██  ░██         ░████   ░██
░██  ░██  ░██  ░██  ░██  ░██     ░██ ░██    ░██ ░██         ░██░██  ░██
░██ ░████ ░██ ░█████████ ░█████████  ░██    ░██ ░█████████  ░██ ░██ ░██
░██░██ ░██░██ ░██    ░██ ░██   ░██   ░██    ░██ ░██         ░██  ░██░██
░████   ░████ ░██    ░██ ░██    ░██  ░██   ░██  ░██         ░██   ░████
░███     ░███ ░██    ░██ ░██     ░██ ░███████   ░██████████ ░██    ░███

`) + chalk.dim(`  Agent Development CLI v${pkg.version}\n`)
  );
}

export function prompt(): string {
  return chalk.rgb(199, 255, 142)("warden") + chalk.dim("> ");
}

export function commandHelp(
  name: string,
  description: string,
  usage?: string,
): string {
  let output = `  ${chalk.rgb(199, 255, 142)("/" + name)}`;
  output += chalk.dim(` - ${description}`);
  if (usage) {
    output += `\n    ${chalk.dim("Usage:")} ${usage}`;
  }
  return output;
}
