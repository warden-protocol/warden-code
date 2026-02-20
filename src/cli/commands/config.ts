import * as path from "node:path";
import { select, input, confirm, password } from "@inquirer/prompts";
import chalk from "chalk";
import type { SlashCommand, CliContext } from "../types.js";
import { fileExists } from "../services/project.js";
import {
  readProjectConfig,
  writeServerConfig,
  writeIdentityConfig,
  writeSkillsConfig,
  writePaymentConfig,
  type AgentProjectConfig,
  type AgentCardSkill,
} from "../services/agent-config.js";
import { tagSkill } from "../services/oasf-tagger.js";

const promptTheme = {
  style: {
    answer: (text: string) => chalk.rgb(199, 255, 142)(text),
    highlight: (text: string) => chalk.rgb(199, 255, 142)(text),
    description: (text: string) => chalk.rgb(199, 255, 142)(text),
  },
};

const NETWORK_PREFIX_MAP: Record<string, string> = {
  "eip155:84532": "X402_BASE_SEPOLIA",
  "eip155:8453": "X402_BASE",
};

// ── Dashboard display ──────────────────────────────────────────

function displayConfig(config: AgentProjectConfig): void {
  const g = chalk.rgb(199, 255, 142);
  const d = chalk.dim;

  console.log();
  console.log(chalk.bold("Agent Configuration"));
  console.log(d("\u2500".repeat(50)));

  // Identity
  console.log(chalk.bold("  Identity"));
  console.log(`    Name:         ${g(config.identity.name)}`);
  console.log(`    Description:  ${g(config.identity.description)}`);
  console.log(`    URL:          ${g(config.identity.url)}`);
  console.log(`    Version:      ${g(config.identity.version)}`);
  console.log();

  // Server
  console.log(chalk.bold("  Server"));
  console.log(`    Host:         ${g(config.server.host)}`);
  console.log(`    Port:         ${g(config.server.port)}`);
  console.log(`    Agent URL:    ${g(config.server.agentUrl)}`);
  if (config.server.openaiModel) {
    console.log(`    Model:        ${g(config.server.openaiModel)}`);
  }
  if (config.server.openaiApiKey) {
    const key = config.server.openaiApiKey;
    const masked =
      key.length > 11 ? key.slice(0, 7) + "..." + key.slice(-4) : "***";
    console.log(`    API Key:      ${d(masked)}`);
  }
  console.log();

  // Skills
  console.log(chalk.bold("  Skills"));
  if (config.skills.length === 0) {
    console.log(`    ${d("None")}`);
  } else {
    for (const skill of config.skills) {
      console.log(`    ${g(skill.name)} ${d(`(${skill.id})`)}`);
      console.log(`      ${d(skill.description)}`);
    }
  }
  console.log();

  // Payments
  console.log(chalk.bold("  Payments"));
  if (!config.payments.enabled) {
    console.log(`    x402:         ${d("Disabled")}`);
  } else {
    console.log(`    x402:         ${g("Enabled")}`);
    if (config.payments.facilitatorUrl) {
      console.log(`    Facilitator:  ${d(config.payments.facilitatorUrl)}`);
    }
    for (const net of config.payments.networks) {
      console.log(`    ${d(net.network)}`);
      console.log(`      Pay to:     ${g(net.payTo)}`);
      console.log(`      Price:      ${g(net.price + " USDC")}`);
    }
  }

  console.log(d("\u2500".repeat(50)));
  console.log();
}

// ── Category editors ───────────────────────────────────────────

async function editIdentity(
  projectDir: string,
  config: AgentProjectConfig,
  context: CliContext,
): Promise<void> {
  const name = await input({
    message: "Agent name:",
    default: config.identity.name,
    theme: promptTheme,
  });

  const description = await input({
    message: "Description:",
    default: config.identity.description,
    theme: promptTheme,
  });

  const url = await input({
    message: "Agent URL:",
    default: config.identity.url,
    theme: promptTheme,
  });

  const version = await input({
    message: "Version:",
    default: config.identity.version,
    theme: promptTheme,
  });

  await writeIdentityConfig(projectDir, { name, description, url, version });
  context.log.success("Identity updated.");
}

export function suggestAgentUrl(host: string, port: string): string {
  if (port === "443") return `https://${host}`;
  if (port === "80") return `http://${host}`;
  return `http://${host}:${port}`;
}

async function editServer(
  projectDir: string,
  config: AgentProjectConfig,
  context: CliContext,
): Promise<void> {
  const host = await input({
    message: "Host:",
    default: config.server.host,
    theme: promptTheme,
  });

  const port = await input({
    message: "Port:",
    default: config.server.port,
    validate: (v) => /^\d+$/.test(v.trim()) || "Port must be a number",
    theme: promptTheme,
  });

  const suggestedUrl = suggestAgentUrl(host, port);
  const agentUrl = await input({
    message: "Agent URL:",
    default:
      host !== config.server.host || port !== config.server.port
        ? suggestedUrl
        : config.server.agentUrl,
    theme: promptTheme,
  });

  let openaiApiKey = config.server.openaiApiKey;
  let openaiModel = config.server.openaiModel;

  if (config.server.openaiApiKey !== undefined) {
    openaiModel = await input({
      message: "OpenAI model:",
      default: config.server.openaiModel || "gpt-4o-mini",
      theme: promptTheme,
    });

    const changeKey = await confirm({
      message: "Change OpenAI API key?",
      default: false,
      theme: promptTheme,
    });

    if (changeKey) {
      openaiApiKey = await password({
        message: "Enter new OpenAI API key:",
        theme: promptTheme,
      });
    }
  }

  await writeServerConfig(projectDir, {
    host,
    port,
    agentUrl,
    openaiApiKey,
    openaiModel,
  });

  // Sync agent URL to agent-card.json if it changed
  if (agentUrl !== config.server.agentUrl) {
    await writeIdentityConfig(projectDir, {
      ...config.identity,
      url: agentUrl,
    });
  }

  context.log.success("Server configuration updated.");
}

async function editSkills(
  projectDir: string,
  config: AgentProjectConfig,
  context: CliContext,
): Promise<void> {
  const choices: Array<{
    value: "edit" | "add" | "remove" | "back";
    name: string;
    description: string;
  }> = [];

  if (config.skills.length > 0) {
    choices.push({
      value: "edit",
      name: "Edit a skill",
      description: "Change name, description, or ID",
    });
  }

  choices.push({
    value: "add",
    name: "Add a skill",
    description: "Define a new agent capability",
  });

  if (config.skills.length > 0) {
    choices.push({
      value: "remove",
      name: "Remove a skill",
      description: "Delete a skill from the agent card",
    });
  }

  choices.push({ value: "back", name: "Back", description: "" });

  const action = await select({
    message: "Skill settings:",
    choices,
    theme: promptTheme,
  });

  if (action === "back") return;

  if (action === "edit") {
    let target: AgentCardSkill;
    if (config.skills.length === 1) {
      target = config.skills[0]!;
    } else {
      target = await select({
        message: "Which skill?",
        choices: config.skills.map((s) => ({
          value: s,
          name: `${s.name} (${s.id})`,
        })),
        theme: promptTheme,
      });
    }

    target.id = await input({
      message: "Skill ID:",
      default: target.id,
      validate: (v) => !!v.trim() || "Skill ID is required",
      theme: promptTheme,
    });

    target.name = await input({
      message: "Skill name:",
      default: target.name,
      theme: promptTheme,
    });

    target.description = await input({
      message: "Skill description:",
      default: target.description,
      theme: promptTheme,
    });

    target.tags = tagSkill(target.name, target.description);
  }

  if (action === "add") {
    const id = await input({
      message: "Skill ID (e.g., general-assistant):",
      validate: (v) => !!v.trim() || "Skill ID is required",
      theme: promptTheme,
    });

    const name = await input({
      message: "Skill name:",
      default: id
        .split("-")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" "),
      theme: promptTheme,
    });

    const description = await input({
      message: "Skill description:",
      default: `${name} capability`,
      theme: promptTheme,
    });

    config.skills.push({
      id,
      name,
      description,
      tags: tagSkill(name, description),
    });
  }

  if (action === "remove") {
    const target = await select({
      message: "Remove which skill?",
      choices: config.skills.map((s, i) => ({
        value: i,
        name: `${s.name} (${s.id})`,
      })),
      theme: promptTheme,
    });

    const confirmed = await confirm({
      message: "Remove this skill?",
      default: false,
      theme: promptTheme,
    });

    if (confirmed) {
      config.skills.splice(target, 1);
    } else {
      return;
    }
  }

  await writeSkillsConfig(projectDir, config.skills);
  context.log.success("Skills updated.");
}

async function editPayments(
  projectDir: string,
  config: AgentProjectConfig,
  context: CliContext,
): Promise<void> {
  const choices: Array<{
    value: "edit" | "add" | "remove" | "back";
    name: string;
    description: string;
  }> = [];

  if (config.payments.networks.length > 0) {
    choices.push({
      value: "edit",
      name: "Edit existing networks",
      description: "Change wallet address or price",
    });
  }

  choices.push({
    value: "add",
    name: "Add a payment network",
    description: "Configure a new network (Base Sepolia, Base mainnet)",
  });

  if (config.payments.networks.length > 0) {
    choices.push({
      value: "remove",
      name: "Remove a payment network",
      description: "Disable payments on a specific network",
    });
  }

  choices.push({ value: "back", name: "Back", description: "" });

  const action = await select({
    message: "Payment settings:",
    choices,
    theme: promptTheme,
  });

  if (action === "back") return;

  if (action === "edit") {
    let target = config.payments.networks[0]!;
    if (config.payments.networks.length > 1) {
      target = await select({
        message: "Which network?",
        choices: config.payments.networks.map((n) => ({
          value: n,
          name: `${n.network} (${n.price} USDC)`,
        })),
        theme: promptTheme,
      });
    }

    target.payTo = (
      await input({
        message: "Wallet address (0x...):",
        default: target.payTo,
        validate: (v) =>
          /^0x[a-fA-F0-9]{40}$/.test(v.trim()) ||
          "Enter a valid Ethereum address (0x followed by 40 hex characters)",
        theme: promptTheme,
      })
    ).trim();

    target.price = await input({
      message: "Price per request (USDC):",
      default: target.price,
      theme: promptTheme,
    });
  }

  if (action === "add") {
    const existingNetworks = new Set(
      config.payments.networks.map((n) => n.network),
    );

    const availableChoices = [
      {
        value: "eip155:84532",
        name: "Base Sepolia (testnet)",
        description: "Free test USDC, uses x402.org facilitator",
      },
      {
        value: "eip155:8453",
        name: "Base (mainnet)",
        description: "Real USDC, uses PayAI facilitator",
      },
    ].filter((c) => !existingNetworks.has(c.value));

    if (availableChoices.length === 0) {
      context.log.dim("All available networks are already configured.");
      return;
    }

    const network = await select({
      message: "Payment network:",
      choices: availableChoices,
      theme: promptTheme,
    });

    const payTo = (
      await input({
        message: "Wallet address (0x...):",
        validate: (v) =>
          /^0x[a-fA-F0-9]{40}$/.test(v.trim()) ||
          "Enter a valid Ethereum address (0x followed by 40 hex characters)",
        theme: promptTheme,
      })
    ).trim();

    const price = await input({
      message: "Price per request (USDC):",
      default: "0.01",
      theme: promptTheme,
    });

    config.payments.networks.push({
      prefix: NETWORK_PREFIX_MAP[network] || network,
      network,
      payTo,
      price,
    });
  }

  if (action === "remove") {
    const target = await select({
      message: "Remove which network?",
      choices: config.payments.networks.map((n, i) => ({
        value: i,
        name: `${n.network} (${n.payTo.slice(0, 10)}...)`,
      })),
      theme: promptTheme,
    });

    const confirmed = await confirm({
      message: "Remove this payment network?",
      default: false,
      theme: promptTheme,
    });

    if (confirmed) {
      config.payments.networks.splice(target, 1);
    } else {
      return;
    }
  }

  // Recompute derived fields
  const hasMainnet = config.payments.networks.some(
    (n) => n.network === "eip155:8453",
  );
  config.payments.enabled = config.payments.networks.length > 0;
  config.payments.facilitatorUrl =
    config.payments.networks.length > 0
      ? hasMainnet
        ? "https://facilitator.payai.network"
        : "https://x402.org/facilitator"
      : undefined;
  config.payments.x402Support = config.payments.networks.length > 0;
  config.payments.x402Networks = [
    ...new Set(
      config.payments.networks.map((n) =>
        n.network.startsWith("eip155:") ? "evm" : "solana",
      ),
    ),
  ];

  await writePaymentConfig(projectDir, config.payments);
  context.log.success("Payment configuration updated.");
}

// ── Command ────────────────────────────────────────────────────

export const configCommand: SlashCommand = {
  name: "config",
  description: "View and edit agent configuration",
  aliases: ["cfg"],
  usage: "/config [path] [show]",
  order: 8,
  handler: async (args: string[], context: CliContext) => {
    const showOnly = args.includes("show");
    const targetPath = args.find((a) => a !== "show");
    const projectDir = targetPath
      ? path.resolve(context.cwd, targetPath)
      : context.cwd;

    // Check for scaffolded project
    const hasAgent = await fileExists(path.join(projectDir, "src", "agent.ts"));
    if (!hasAgent) {
      context.log.error(
        targetPath
          ? `No agent project found in ${targetPath}. Run /new ${targetPath} first.`
          : "No agent project found. Run /new to create one first.",
      );
      return;
    }

    // Read current configuration
    let config = await readProjectConfig(projectDir);
    if (!config) {
      context.log.error(
        "Could not read project configuration. Check that agent-card.json exists and is valid JSON.",
      );
      return;
    }

    displayConfig(config);

    if (showOnly) return;

    try {
      let editing = true;
      while (editing) {
        const category = await select({
          message: "What would you like to edit?",
          choices: [
            {
              value: "identity" as const,
              name: "Identity",
              description: "Name, description, URL, version",
            },
            {
              value: "server" as const,
              name: "Server",
              description: "Port, host, agent URL, API key, model",
            },
            {
              value: "skills" as const,
              name: "Skills",
              description: "Agent capabilities advertised in the agent card",
            },
            {
              value: "payments" as const,
              name: "Payments",
              description: "x402 wallets, pricing, networks",
            },
            {
              value: "done" as const,
              name: "Done",
              description: "Save and exit configuration",
            },
          ],
          theme: promptTheme,
        });

        if (category === "done") {
          editing = false;
          break;
        }

        switch (category) {
          case "identity":
            await editIdentity(projectDir, config, context);
            break;
          case "server":
            await editServer(projectDir, config, context);
            break;
          case "skills":
            await editSkills(projectDir, config, context);
            break;
          case "payments":
            await editPayments(projectDir, config, context);
            break;
        }

        // Re-read and redisplay after changes
        const updated = await readProjectConfig(projectDir);
        if (updated) {
          config = updated;
          displayConfig(config);
        }
      }
    } catch (error) {
      if (error instanceof Error && error.name === "ExitPromptError") {
        console.log();
        context.log.dim("Cancelled.");
        return;
      }
      throw error;
    }
  },
};
