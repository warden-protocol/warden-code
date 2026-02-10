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

async function readSharedTemplate(filename: string): Promise<string> {
  const filePath = path.resolve(__dirname, "../../templates", filename);
  return fs.readFile(filePath, "utf-8");
}

export function processTemplate(content: string, config: AgentConfig): string {
  const skillsStr = config.skills
    .map(
      (s) =>
        `{\n        id: "${s.id}",\n        name: "${s.name}",\n        description: "${s.description}",\n        tags: [],\n      }`,
    )
    .join(",\n      ");

  const modelStartupLog =
    config.template === "openai"
      ? `const hasApiKey = !!process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
  console.log(\`Model: \${model}\`);
  console.log(\`API Key: \${hasApiKey ? "configured" : "NOT SET"}\`);`
      : "";

  return content
    .replace(/\{\{name\}\}/g, config.name)
    .replace(/\{\{description\}\}/g, config.description)
    .replace(/\{\{skills\}\}/g, skillsStr)
    .replace(
      /\{\{capabilities_streaming\}\}/g,
      String(config.capabilities.streaming),
    )
    .replace(
      /\{\{capabilities_multiturn\}\}/g,
      String(config.capabilities.multiTurn),
    )
    .replace(/\{\{model_startup_log\}\}/g, modelStartupLog)
    .replace(/\{\{packageName\}\}/g, config.packageName)
    .replace(
      /\{\{model_dependencies\}\}/g,
      config.template === "openai" ? `,\n    "openai": "^4.69.0"` : "",
    )
    .replace(
      /\{\{env_setup\}\}/g,
      config.template === "openai"
        ? `Copy the example environment file and configure your API key:

\`\`\`bash
cp .env.example .env
\`\`\`

Edit \`.env\` and set your \`OPENAI_API_KEY\`.

`
        : "",
    )
    .replace(
      /\{\{env_model_config\}\}/g,
      config.template === "openai"
        ? `OPENAI_API_KEY=your-api-key-here\nOPENAI_MODEL=gpt-4o-mini\n`
        : "",
    );
}

/**
 * Get the template directory name based on base template and capability.
 */
function getTemplateDirName(config: AgentConfig): string {
  const capability = config.capabilities.streaming ? "streaming" : "multiturn";
  return `${config.template}-${capability}`;
}

export async function scaffoldAgent(
  targetDir: string,
  config: AgentConfig,
): Promise<void> {
  // Get the appropriate template directory based on template + capability
  const templateDirName = getTemplateDirName(config);

  // Read and process the agent handler template
  const agentTemplate = await readTemplate(
    templateDirName,
    "agent.ts.template",
  );
  const agentContent = processTemplate(agentTemplate, config);

  // Read and process the shared server template
  const serverTemplate = await readSharedTemplate("server.ts.template");
  const serverContent = processTemplate(serverTemplate, config);

  // Write the agent and server files
  await writeFile(path.join(targetDir, "src", "agent.ts"), agentContent);
  await writeFile(path.join(targetDir, "src", "server.ts"), serverContent);

  // Write package.json
  const pkgTemplate = await readSharedTemplate("package.json.template");
  const pkgContent = processTemplate(pkgTemplate, config);
  await writeFile(path.join(targetDir, "package.json"), pkgContent);

  // Write tsconfig.json
  const tsconfig = await readSharedTemplate("tsconfig.json.template");
  await writeFile(path.join(targetDir, "tsconfig.json"), tsconfig);

  // Write .gitignore
  const gitignore = await readSharedTemplate("gitignore.template");
  await writeFile(path.join(targetDir, ".gitignore"), gitignore);

  // Write .env.example
  const envTemplate = await readSharedTemplate("env.example.template");
  const envContent = processTemplate(envTemplate, config);
  await writeFile(path.join(targetDir, ".env.example"), envContent);

  // Write Dockerfile
  const dockerfile = await readSharedTemplate("Dockerfile.template");
  await writeFile(path.join(targetDir, "Dockerfile"), dockerfile);

  // Write README.md
  const readmeTemplate = await readSharedTemplate("README.md.template");
  const readme = processTemplate(readmeTemplate, config);
  await writeFile(path.join(targetDir, "README.md"), readme);
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
