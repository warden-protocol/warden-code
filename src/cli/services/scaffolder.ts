import * as fs from "node:fs/promises";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import type { AgentConfig } from "../types.js";
import { writeFile } from "./project.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function getTemplateDir(template: string): Promise<string> {
  // Navigate from dist/cli/services to dist/templates
  return path.resolve(__dirname, "../../templates", template);
}

export async function readTemplate(
  template: string,
  filename: string,
): Promise<string> {
  const templateDir = await getTemplateDir(template);
  const filePath = path.join(templateDir, filename);
  return fs.readFile(filePath, "utf-8");
}

export function processTemplate(content: string, config: AgentConfig): string {
  const skillsStr = config.skills
    .map(
      (s) =>
        `{\n        id: "${s.id}",\n        name: "${s.name}",\n        description: "${s.description}",\n        tags: [],\n      }`,
    )
    .join(",\n      ");

  return content
    .replace(/\{\{name\}\}/g, config.name)
    .replace(/\{\{description\}\}/g, config.description)
    .replace(/\{\{skills\}\}/g, skillsStr);
}

/**
 * Get the template directory name based on base template and capability.
 */
function getTemplateDirName(config: AgentConfig): string {
  const capability = config.capabilities.streaming ? "streaming" : "multiturn";
  return `${config.template}-${capability}`;
}

function generatePackageJson(config: AgentConfig): string {
  const pkg: Record<string, unknown> = {
    name: config.packageName,
    version: "0.1.0",
    type: "module",
    main: "dist/agent.js",
    scripts: {
      build: "tsc",
      dev: "tsc --watch",
      agent: "node dist/agent.js",
    },
    dependencies: {
      "@wardenprotocol/agent-kit": "^0.3.1",
      dotenv: "^16.4.0",
    } as Record<string, string>,
    devDependencies: {
      "@types/node": "^22.8.1",
      typescript: "^5.6.3",
    },
  };

  // Add OpenAI dependency if using OpenAI template
  if (config.template === "openai") {
    (pkg.dependencies as Record<string, string>)["openai"] = "^4.69.0";
  }

  return JSON.stringify(pkg, null, 2);
}

function generateTsConfig(): string {
  const tsconfig = {
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

  return JSON.stringify(tsconfig, null, 2);
}

const GITIGNORE = `node_modules/
dist/
coverage/
*.log
.DS_Store
.env
.env.local
`;

const ENV_EXAMPLE_BLANK = `HOST=localhost
PORT=3000
`;

const ENV_EXAMPLE_OPENAI = `HOST=localhost
PORT=3000
OPENAI_API_KEY=your-api-key-here
OPENAI_MODEL=gpt-4o-mini
`;

export async function scaffoldAgent(
  targetDir: string,
  config: AgentConfig,
): Promise<void> {
  // Get the appropriate template directory based on template + capability
  const templateDirName = getTemplateDirName(config);

  // Read and process the agent template
  const templateContent = await readTemplate(
    templateDirName,
    "agent.ts.template",
  );
  const processedContent = processTemplate(templateContent, config);

  // Write the agent file
  await writeFile(path.join(targetDir, "src", "agent.ts"), processedContent);

  // Write package.json
  await writeFile(
    path.join(targetDir, "package.json"),
    generatePackageJson(config),
  );

  // Write tsconfig.json
  await writeFile(path.join(targetDir, "tsconfig.json"), generateTsConfig());

  // Write .gitignore
  await writeFile(path.join(targetDir, ".gitignore"), GITIGNORE);

  // Write .env.example
  const envExample =
    config.template === "openai" ? ENV_EXAMPLE_OPENAI : ENV_EXAMPLE_BLANK;
  await writeFile(path.join(targetDir, ".env.example"), envExample);
}

/**
 * Check if a template exists.
 */
export async function templateExists(template: string): Promise<boolean> {
  try {
    const dir = await getTemplateDir(template);
    await fs.access(dir);
    return true;
  } catch {
    return false;
  }
}
