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

  const skillsJsonStr = config.skills
    .map((s) =>
      JSON.stringify(
        { id: s.id, name: s.name, description: s.description, tags: [] },
        null,
        4,
      ),
    )
    .join(",\n  ");

  const modelStartupLog =
    config.template === "openai"
      ? `const hasApiKey = !!process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
  console.log(\`Model: \${model}\`);
  console.log(\`API Key: \${hasApiKey ? "configured" : "NOT SET"}\`);`
      : "";

  const hasX402 = !!config.x402;

  const x402Imports = hasX402
    ? `import express from "express";
import { paymentMiddleware, x402ResourceServer } from "@x402/express";
import { HTTPFacilitatorClient } from "@x402/core/server";
import { registerExactEvmScheme } from "@x402/evm/exact/server";
import type { Network } from "@x402/core/types";`
    : "";

  const x402Listen = hasX402
    ? `const a2aHandler = server.getA2AServer().getHandler();
const langGraphHandler = server.getLangGraphServer().getHandler();

const facilitatorClient = new HTTPFacilitatorClient({
  url: process.env.X402_FACILITATOR_URL || "https://x402.org/facilitator",
});
const resourceServer = new x402ResourceServer(facilitatorClient);
registerExactEvmScheme(resourceServer);

const app = express();

app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, PAYMENT-SIGNATURE, X-PAYMENT, Access-Control-Expose-Headers");
  res.setHeader("Access-Control-Expose-Headers", "PAYMENT-REQUIRED, PAYMENT-RESPONSE, X-PAYMENT-RESPONSE");
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  next();
});

app.use(
  paymentMiddleware(
    {
      "POST /": {
        accepts: [
          {
            scheme: "exact",
            price: process.env.X402_PRICE || "${config.x402!.price}",
            network: (process.env.X402_NETWORK || "${config.x402!.network}") as Network,
            payTo: process.env.X402_PAY_TO_ADDRESS!,
          },
        ],
        description: "{{description}}",
        mimeType: "application/json",
      },
    },
    resourceServer,
  ),
);

app.all("*", (req, res) => {
  const url = req.url || "/";
  const isLangGraph =
    url.startsWith("/info") ||
    url.startsWith("/ok") ||
    url.startsWith("/assistants") ||
    url.startsWith("/threads") ||
    url.startsWith("/runs") ||
    url.startsWith("/store");
  const routeHandler = isLangGraph ? langGraphHandler : a2aHandler;
  routeHandler(req, res);
});

app.listen(PORT, () => {
  {{model_startup_log}}
  console.log(\`{{name}} (Dual Protocol + x402 Payments)\`);
  console.log(\`Server: \${AGENT_URL}\`);
  console.log();
  console.log("x402 Payments:");
  console.log(\`  Price (USDC):      \${process.env.X402_PRICE || "${config.x402!.price}"}\`);
  console.log(\`  Network:    \${process.env.X402_NETWORK || "${config.x402!.network}"}\`);
  console.log(\`  Pay To:     \${process.env.X402_PAY_TO_ADDRESS || "NOT SET"}\`);
  console.log();
  console.log("A2A Protocol:");
  console.log(\`  Agent Card: \${AGENT_URL}/.well-known/agent-card.json\`);
  console.log(\`  JSON-RPC:   POST \${AGENT_URL}/\`);
  console.log();
  console.log("LangGraph Protocol:");
  console.log(\`  Info:       \${AGENT_URL}/info\`);
  console.log(\`  Assistants: \${AGENT_URL}/assistants\`);
  console.log(\`  Threads:    \${AGENT_URL}/threads\`);
  console.log(\`  Runs:       \${AGENT_URL}/runs\`);
});`
    : `server.listen(PORT).then(() => {
  {{model_startup_log}}
  console.log(\`{{name}} (Dual Protocol)\`);
  console.log(\`Server: \${AGENT_URL}\`);
  console.log();
  console.log("A2A Protocol:");
  console.log(\`  Agent Card: \${AGENT_URL}/.well-known/agent-card.json\`);
  console.log(\`  JSON-RPC:   POST \${AGENT_URL}/\`);
  console.log();
  console.log("LangGraph Protocol:");
  console.log(\`  Info:       \${AGENT_URL}/info\`);
  console.log(\`  Assistants: \${AGENT_URL}/assistants\`);
  console.log(\`  Threads:    \${AGENT_URL}/threads\`);
  console.log(\`  Runs:       \${AGENT_URL}/runs\`);
});`;

  const x402Dependencies = hasX402
    ? `,\n    "express": "^4.21.0",\n    "@x402/express": "^2.3.0",\n    "@x402/core": "^2.3.0",\n    "@x402/evm": "^2.3.0"`
    : "";

  const x402DevDependencies = hasX402
    ? `,\n    "@types/express": "^5.0.0"`
    : "";

  const x402EnvConfig = hasX402
    ? `X402_PAY_TO_ADDRESS=0xYourWalletAddress\nX402_PRICE=${config.x402!.price}\nX402_NETWORK=${config.x402!.network}\nX402_FACILITATOR_URL=https://x402.org/facilitator\n`
    : "";

  const x402EnvSetup = hasX402
    ? `## x402 Payments

This agent uses [x402](https://x402.org) to charge per request using USDC.

Set the following environment variables in \`.env\`:

- \`X402_PAY_TO_ADDRESS\` \u2014 your wallet address to receive payments
- \`X402_PRICE\` \u2014 price per request (default: ${config.x402!.price})
- \`X402_NETWORK\` \u2014 blockchain network (default: ${config.x402!.network})
- \`X402_FACILITATOR_URL\` \u2014 facilitator service URL

`
    : "";

  // x402 structural placeholders are replaced first so their content
  // (which may contain {{name}}, {{description}}, {{model_startup_log}})
  // gets resolved by the subsequent replacements.
  return content
    .replace(/\{\{x402_imports\}\}/g, x402Imports)
    .replace(/\{\{x402_listen\}\}/g, x402Listen)
    .replace(/\{\{x402_dependencies\}\}/g, x402Dependencies)
    .replace(/\{\{x402_dev_dependencies\}\}/g, x402DevDependencies)
    .replace(/\{\{x402_env_config\}\}/g, x402EnvConfig)
    .replace(/\{\{x402_env_setup\}\}/g, x402EnvSetup)
    .replace(/\{\{name\}\}/g, config.name)
    .replace(/\{\{description\}\}/g, config.description)
    .replace(/\{\{skills\}\}/g, skillsStr)
    .replace(/\{\{skills_json\}\}/g, skillsJsonStr)
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
        ? `Copy the example environment file and configure your API key:\n\n\`\`\`bash\ncp .env.example .env\n\`\`\`\n\nEdit \`.env\` and set your \`OPENAI_API_KEY\`.\n\n`
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

  // Read and process the agent card template
  const agentCardTemplate = await readSharedTemplate(
    "agent-card.json.template",
  );
  const agentCardContent = processTemplate(agentCardTemplate, config);

  // Write the agent and server files
  await writeFile(path.join(targetDir, "agent-card.json"), agentCardContent);
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
