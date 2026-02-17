import chalk from "chalk";
import ora from "ora";
import type { CliContext, Logger } from "./types.js";

function createLogger(): Logger {
  return {
    info: (msg: string) => console.log(chalk.rgb(199, 255, 142)("ℹ"), msg),
    success: (msg: string) => console.log(chalk.rgb(199, 255, 142)("✓"), msg),
    error: (msg: string) => console.log(chalk.red("✗"), msg),
    warn: (msg: string) => console.log(chalk.rgb(199, 255, 142)("⚠"), msg),
    dim: (msg: string) => console.log(chalk.dim(msg)),
  };
}

export function createContext(cwd: string): CliContext {
  return {
    cwd,
    log: createLogger(),
    spinner: (msg: string) => ora({ text: msg, discardStdin: false }),
  };
}
