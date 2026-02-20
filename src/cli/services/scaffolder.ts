import * as fs from "node:fs/promises";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import type { AgentConfig } from "../types.js";
import { tagSkill } from "./oasf-tagger.js";
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
    .map((s) => {
      const tags = tagSkill(s.name, s.description);
      const tagsLiteral =
        tags.length > 0 ? `[${tags.map((t) => `"${t}"`).join(", ")}]` : "[]";
      return `{\n        id: "${s.id}",\n        name: "${s.name}",\n        description: "${s.description}",\n        tags: ${tagsLiteral},\n      }`;
    })
    .join(",\n      ");

  const skillsJsonStr = config.skills
    .map((s) =>
      JSON.stringify(
        {
          id: s.id,
          name: s.name,
          description: s.description,
          tags: tagSkill(s.name, s.description),
        },
        null,
        4,
      ),
    )
    .join(",\n  ");

  const modelStartupLog =
    config.provider === "openai"
      ? `const hasApiKey = !!process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
  console.log(\`Model: \${model}\`);
  console.log(\`API Key: \${hasApiKey ? "configured" : "NOT SET"}\`);`
      : "";

  const accepts = config.x402?.accepts ?? [];
  const hasX402Config = accepts.length > 0;
  const hasEvm = accepts.some((a) => a.network.startsWith("eip155:"));

  const x402Imports = `import { getPaymentConfig, createPaymentApp } from "./payments.js";`;

  // Shared block: create a custom HTTP server that serves static files
  // from public/ and delegates everything else to the A2A/LangGraph handlers.
  const listenBlock = `const a2aHandler = server.getA2AServer().getHandler();
const langGraphHandler = server.getLangGraphServer().getHandler();

const httpServer = createServer((req, res) => {
  if (serveStatic(req, res)) return;
  const url = req.url || "/";
  const isLangGraph = url.startsWith("/info") || url.startsWith("/ok")
    || url.startsWith("/assistants") || url.startsWith("/threads")
    || url.startsWith("/runs") || url.startsWith("/store");
  const handler = isLangGraph ? langGraphHandler : a2aHandler;
  handler(req, res);
});

httpServer.listen(PORT, () => {
  {{model_startup_log}}
  console.log(\`{{name}} (Dual Protocol)\`);
  console.log(\`Server: \${AGENT_URL}\`);
  console.log(\`Frontend: \${AGENT_URL}/\`);
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

  const x402Listen = `const paymentConfig = getPaymentConfig();

if (paymentConfig) {
  const app = createPaymentApp(
    paymentConfig,
    "{{description}}",
    server.getA2AServer().getHandler(),
    server.getLangGraphServer().getHandler(),
  );

  app.listen(PORT, () => {
    {{model_startup_log}}
    console.log(\`{{name}} (Dual Protocol + x402 Payments)\`);
    console.log(\`Server: \${AGENT_URL}\`);
    console.log(\`Frontend: \${AGENT_URL}/\`);
    console.log();
    console.log("x402 Payments:");
    console.log(\`  Facilitator: \${paymentConfig.facilitatorUrl}\`);
    if (paymentConfig.isPayAI) {
      console.log(\`  API Key:     \${process.env.PAYAI_API_KEY_ID ? "configured" : "not set (using free tier)"}\`);
    }
    for (const a of paymentConfig.accepts) {
      console.log(\`  \${a.network}: \${a.price} USDC -> \${a.payTo.slice(0, 8)}...\`);
    }
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
  });
} else {
  ${listenBlock}
}`;

  const x402Dependencies = `,\n    "express": "^4.21.0",\n    "@x402/express": "^2.3.0",\n    "@x402/core": "^2.3.0",\n    "@payai/facilitator": "^2.2.4",\n    "@x402/evm": "^2.3.0"`;

  const x402DevDependencies = `,\n    "@types/express": "^5.0.0"`;

  // Generate env config lines for the configured networks (active)
  // plus commented-out lines for all other networks (available to enable)
  const allNetworks = [
    {
      id: "eip155:84532",
      prefix: "X402_BASE_SEPOLIA",
      label: "Base Sepolia (testnet)",
    },
    { id: "eip155:8453", prefix: "X402_BASE", label: "Base (mainnet)" },
  ];

  // Determine the default facilitator URL based on whether any mainnet network is configured
  const mainnetIds = new Set(["eip155:8453"]);
  const hasMainnet = accepts.some((a) => mainnetIds.has(a.network));
  const defaultFacilitator = hasMainnet
    ? "https://facilitator.payai.network"
    : "https://x402.org/facilitator";

  const x402EnvLines: string[] = [];

  // Facilitator URL (shared across all networks)
  x402EnvLines.push(`X402_FACILITATOR_URL=${defaultFacilitator}`, "");

  for (const net of allNetworks) {
    const isActive = accepts.some((a) => a.network === net.id);
    const comment = isActive ? "" : "# ";
    const hint = isActive ? "" : " (disabled, set PAY_TO to enable)";
    x402EnvLines.push(
      `# ${net.label}${hint}`,
      `${comment}${net.prefix}_PAY_TO=`,
      `${comment}${net.prefix}_PRICE=0.01`,
      `${comment}${net.prefix}_NETWORK=${net.id}`,
      "",
    );
  }

  x402EnvLines.push(
    "# Facilitator authentication (optional, for paid tiers)",
    "# PayAI: set PAYAI_API_KEY_ID and PAYAI_API_KEY_SECRET",
    "# Get credentials at https://merchant.payai.network",
    "",
  );

  const x402EnvConfig = x402EnvLines.join("\n") + "\n";

  const x402EnvSetup = `## x402 Payments\n\nThis agent uses [x402](https://x402.org) to charge per request using USDC.\n\nPayment configuration is read from environment variables at startup:\n\n- \`X402_FACILITATOR_URL\` \u2014 payment facilitator endpoint (shared across all networks)\n- \`X402_<NETWORK>_PAY_TO\` \u2014 wallet address to receive payments (set to enable, remove to disable)\n- \`X402_<NETWORK>_PRICE\` \u2014 price per request in USDC (default: 0.01)\n- \`X402_<NETWORK>_NETWORK\` \u2014 network identifier\n\nAvailable network prefixes: \`X402_BASE_SEPOLIA\`, \`X402_BASE\`, \`X402_SOL_DEVNET\`, \`X402_SOL\`.\n\n### Facilitator\n\nSet \`X402_FACILITATOR_URL\` in \`.env\` to your facilitator of choice. The [PayAI facilitator](https://facilitator.payai.network) offers 1,000 free settlements per month. For higher volumes, create a merchant account at [merchant.payai.network](https://merchant.payai.network) and set \`PAYAI_API_KEY_ID\` and \`PAYAI_API_KEY_SECRET\` in your \`.env\`. Authentication is handled automatically.\n\nTo disable payments entirely, remove all \`PAY_TO\` values from \`.env\`.\nTo add a network, uncomment its section in \`.env\` and set the pay-to address.\n\n`;

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
    .replace(/\{\{x402_support\}\}/g, String(hasX402Config))
    .replace(
      /\{\{x402_networks\}\}/g,
      JSON.stringify([hasEvm && "evm"].filter(Boolean)),
    )
    .replace(/\{\{packageName\}\}/g, config.packageName)
    .replace(
      /\{\{model_dependencies\}\}/g,
      config.provider === "openai" ? `,\n    "openai": "^4.69.0"` : "",
    )
    .replace(
      /\{\{env_setup\}\}/g,
      config.provider === "openai"
        ? `Copy the example environment file and configure your API key:\n\n\`\`\`bash\ncp .env.example .env\n\`\`\`\n\nEdit \`.env\` and set your \`OPENAI_API_KEY\`.\n\n`
        : "",
    )
    .replace(
      /\{\{env_model_config\}\}/g,
      config.provider === "openai"
        ? `OPENAI_API_KEY=your-api-key-here\nOPENAI_MODEL=gpt-4o-mini\n`
        : "",
    );
}

/**
 * Get the template directory name based on base template and capability.
 */
function getTemplateDirName(config: AgentConfig): string {
  const capability = config.capabilities.streaming ? "streaming" : "multiturn";
  return `${config.provider}-${capability}`;
}

/**
 * Build the payments.ts module content for agents with x402 enabled.
 * Returns null when x402 is not configured.
 */
export function buildPaymentsModule(): string {
  const imports = [
    `import { resolve } from "node:path";`,
    `import express from "express";`,
    `import type { Express, RequestHandler } from "express";`,
    `import { paymentMiddleware, x402ResourceServer } from "@x402/express";`,
    `import { HTTPFacilitatorClient } from "@x402/core/server";`,
    `import { createFacilitatorConfig } from "@payai/facilitator";`,
    `import type { Network } from "@x402/core/types";`,
    `import { registerExactEvmScheme } from "@x402/evm/exact/server";`,
  ].join("\n");

  return `${imports}

export interface PaymentAccept {
  scheme: "exact";
  network: Network;
  payTo: string;
  price: string;
}

export interface PaymentConfig {
  facilitatorUrl: string;
  isPayAI: boolean;
  accepts: PaymentAccept[];
}

const x402Networks: { prefix: string; network: string; envPrefix: string }[] = [
  { prefix: "BASE_SEPOLIA", network: "eip155:84532", envPrefix: "X402_BASE_SEPOLIA" },
  { prefix: "BASE", network: "eip155:8453", envPrefix: "X402_BASE" },
];

export function getPaymentConfig(): PaymentConfig | null {
  const enabledNetworks = x402Networks.filter(
    (n) => process.env[\`\${n.envPrefix}_PAY_TO\`],
  );

  const accepts = enabledNetworks.map((n) => ({
    scheme: "exact" as const,
    network: (process.env[\`\${n.envPrefix}_NETWORK\`] || n.network) as Network,
    payTo: process.env[\`\${n.envPrefix}_PAY_TO\`]!,
    price: process.env[\`\${n.envPrefix}_PRICE\`] || "0.01",
  }));

  if (accepts.length === 0) return null;

  const facilitatorUrl =
    process.env.X402_FACILITATOR_URL || "https://x402.org/facilitator";

  return {
    facilitatorUrl,
    isPayAI: facilitatorUrl.includes("payai.network"),
    accepts,
  };
}

export function createPaymentApp(
  config: PaymentConfig,
  description: string,
  a2aHandler: RequestHandler,
  langGraphHandler: RequestHandler,
): Express {
  const facilitatorClient = new HTTPFacilitatorClient({
    ...(config.isPayAI ? createFacilitatorConfig() : {}),
    url: config.facilitatorUrl,
  });
  const resourceServer = new x402ResourceServer(facilitatorClient);

  const hasEvm = config.accepts.some((a) => a.network.startsWith("eip155:"));
  if (hasEvm) registerExactEvmScheme(resourceServer);

  const app = express();

  // Serve static files from public/ (before CORS/payment middleware)
  app.use(express.static(resolve(import.meta.dirname, "../public")));

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
          accepts: config.accepts,
          description,
          mimeType: "application/json",
        },
      },
      resourceServer,
    ),
  );

  app.all("*", (req, res, next) => {
    const url = req.url || "/";
    const isLangGraph =
      url.startsWith("/info") ||
      url.startsWith("/ok") ||
      url.startsWith("/assistants") ||
      url.startsWith("/threads") ||
      url.startsWith("/runs") ||
      url.startsWith("/store");
    const routeHandler = isLangGraph ? langGraphHandler : a2aHandler;
    routeHandler(req, res, next);
  });

  return app;
}
`;
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
  await writeFile(
    path.join(targetDir, "public", ".well-known", "agent-card.json"),
    agentCardContent,
  );
  await writeFile(path.join(targetDir, "src", "agent.ts"), agentContent);
  await writeFile(path.join(targetDir, "src", "server.ts"), serverContent);

  // Write payments module (always included; runtime guards handle activation)
  await writeFile(
    path.join(targetDir, "src", "payments.ts"),
    buildPaymentsModule(),
  );

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

  // Write front-end
  const frontendHtml = await readSharedTemplate("frontend.html");
  await writeFile(path.join(targetDir, "public", "index.html"), frontendHtml);

  // Write agent registration (ERC-8004)
  const regTemplate = await readSharedTemplate(
    "agent-registration.json.template",
  );
  const regContent = processTemplate(regTemplate, config);
  await writeFile(
    path.join(targetDir, "public", ".well-known", "agent-registration.json"),
    regContent,
  );
  await writeFile(
    path.join(targetDir, "public", "agent-registration.json"),
    regContent,
  );

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
