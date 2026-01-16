import * as path from "node:path";
import { confirm } from "@inquirer/prompts";
import type { SlashCommand, CliContext } from "../types.js";
import {
  directoryExists,
  createDirectory,
  writeFile,
} from "../services/project.js";

const BASE_PACKAGE_JSON = {
  name: "",
  version: "0.1.0",
  type: "module",
  main: "dist/agent.js",
  scripts: {
    build: "tsc",
    dev: "tsc --watch",
    agent: "node dist/agent.js",
  },
  dependencies: {
    "@anthropic-ai/sdk": "^0.30.1",
    "@warden-protocol/agentkit": "^0.0.3",
    openai: "^4.69.0",
  },
  devDependencies: {
    "@types/node": "^22.8.1",
    typescript: "^5.6.3",
  },
};

const BASE_TSCONFIG = {
  compilerOptions: {
    target: "ES2022",
    module: "NodeNext",
    moduleResolution: "NodeNext",
    lib: ["ES2022"],
    outDir: "./dist",
    rootDir: "./src",
    strict: true,
    esModuleInterop: true,
    skipLibCheck: true,
    forceConsistentCasingInFileNames: true,
    declaration: true,
    sourceMap: true,
  },
  include: ["src/**/*"],
  exclude: ["node_modules", "dist"],
};

const GITIGNORE = `node_modules/
dist/
*.log
.DS_Store
.env
.env.local
`;

export const initCommand: SlashCommand = {
  name: "init",
  description: "Initialize a new agent project",
  usage: "/init [path]",
  handler: async (args: string[], context: CliContext) => {
    try {
      const targetPath = args[0] || ".";
      const fullPath = path.resolve(context.cwd, targetPath);
      const projectName = path.basename(fullPath);

      console.log();

      // Check if directory exists and has files
      if (await directoryExists(fullPath)) {
        const proceed = await confirm({
          message: `Directory ${targetPath} already exists. Initialize anyway?`,
          default: false,
        });
        if (!proceed) {
          context.log.dim("Cancelled.");
          return;
        }
      }

      const spinner = context.spinner("Creating project structure...").start();

      try {
        // Create directories
        await createDirectory(fullPath);
        await createDirectory(path.join(fullPath, "src"));

        // Write package.json
        const packageJson = {
          ...BASE_PACKAGE_JSON,
          name: projectName,
        };
        await writeFile(
          path.join(fullPath, "package.json"),
          JSON.stringify(packageJson, null, 2),
        );

        // Write tsconfig.json
        await writeFile(
          path.join(fullPath, "tsconfig.json"),
          JSON.stringify(BASE_TSCONFIG, null, 2),
        );

        // Write .gitignore
        await writeFile(path.join(fullPath, ".gitignore"), GITIGNORE);

        // Write .env.example
        await writeFile(
          path.join(fullPath, ".env.example"),
          "OPENAI_API_KEY=your-api-key-here\n",
        );

        spinner.succeed("Project initialized!");
        console.log();
        context.log.info(`Project created at: ${fullPath}`);
        console.log();
        context.log.dim("Next steps (in a new terminal):");
        context.log.dim(`  cd ${targetPath}`);
        context.log.dim("  pnpm install");
        context.log.dim("  /new  # to create your agent");
        console.log();
      } catch (error) {
        spinner.fail("Failed to initialize project");
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
