import * as path from "node:path";
import { select, password, input, confirm, Separator } from "@inquirer/prompts";
import chalk from "chalk";
import type { Hex } from "viem";
import type { SlashCommand, CliContext } from "../types.js";
import { fileExists, readFile, writeFile } from "../services/project.js";
import {
  readProjectConfig,
  registrationPath,
  type AgentProjectConfig,
} from "../services/agent-config.js";
import {
  ERC8004_CHAINS,
  deriveAddress,
  registerAgent,
  setAgentURI,
  type Erc8004Chain,
} from "../services/erc8004.js";

const promptTheme = {
  style: {
    answer: (text: string) => chalk.rgb(199, 255, 142)(text),
    highlight: (text: string) => chalk.rgb(199, 255, 142)(text),
    description: (text: string) => chalk.rgb(199, 255, 142)(text),
  },
};

export interface ValidationIssue {
  level: "error" | "warning";
  message: string;
}

const LOCALHOST_RE = /^https?:\/\/localhost(:\d+)?\/?$/;

export function validateForRegistration(
  config: AgentProjectConfig,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (!config.identity.name.trim()) {
    issues.push({
      level: "error",
      message: "Agent name is missing. Run /config to set it.",
    });
  }

  if (!config.identity.description.trim()) {
    issues.push({
      level: "error",
      message: "Agent description is missing. Run /config to set it.",
    });
  }

  if (
    !config.identity.url.trim() ||
    LOCALHOST_RE.test(config.identity.url.trim())
  ) {
    issues.push({
      level: "error",
      message:
        "Agent URL is still set to localhost. Run /config to set a production URL.",
    });
  }

  if (config.skills.length === 0) {
    issues.push({
      level: "warning",
      message:
        "No skills defined. Agents without skills are harder to discover.",
    });
  }

  for (const skill of config.skills) {
    if (!skill.name.trim()) {
      issues.push({
        level: "warning",
        message: `Skill "${skill.id}" has no name.`,
      });
    }
    if (!skill.description.trim()) {
      issues.push({
        level: "warning",
        message: `Skill "${skill.id}" has no description.`,
      });
    }
  }

  if (
    config.identity.description.trim() &&
    config.identity.description.trim().length < 20
  ) {
    issues.push({
      level: "warning",
      message:
        "Agent description is very short. A detailed description improves discoverability.",
    });
  }

  return issues;
}

function buildChainChoices() {
  const testnets = ERC8004_CHAINS.filter((c) => c.testnet);
  const mainnets = ERC8004_CHAINS.filter((c) => !c.testnet);

  return [
    new Separator(chalk.dim("-- Testnets --")),
    ...testnets.map((c) => ({
      value: c.chainId,
      name: `${c.name} (${c.chainId})`,
    })),
    new Separator(chalk.dim("-- Mainnets --")),
    ...mainnets.map((c) => ({
      value: c.chainId,
      name: `${c.name} (${c.chainId})`,
    })),
  ];
}

export async function setRegistrationActive(
  projectDir: string,
  active: boolean,
): Promise<void> {
  const regFile = registrationPath(projectDir);

  let reg: Record<string, unknown> = {};
  if (await fileExists(regFile)) {
    try {
      reg = JSON.parse(await readFile(regFile)) as Record<string, unknown>;
    } catch {
      // Continue with empty registration if malformed
    }
  }

  reg.active = active;

  await writeFile(regFile, JSON.stringify(reg, null, 2));
}

interface RegistrationEntry {
  agentId: number;
  agentRegistry: string;
}

export function parseRegistrations(
  projectDir: string,
  reg: Record<string, unknown>,
): RegistrationEntry[] {
  if (!Array.isArray(reg.registrations)) return [];
  return reg.registrations.filter(
    (r: Record<string, unknown>) =>
      typeof r.agentId === "number" && typeof r.agentRegistry === "string",
  ) as RegistrationEntry[];
}

export async function updateRegistrationFiles(
  projectDir: string,
  agentUrl: string,
  agentId: bigint,
  chain: Erc8004Chain,
): Promise<void> {
  const regFile = registrationPath(projectDir);
  const agentRegistry = `eip155:${chain.chainId}:${chain.registry}`;
  const a2aEndpoint = `${agentUrl}/.well-known/agent-card.json`;
  const webEndpoint = `${agentUrl}/`;
  const imageUrl = `${agentUrl}/icon.png`;

  let reg: Record<string, unknown> = {};
  if (await fileExists(regFile)) {
    try {
      reg = JSON.parse(await readFile(regFile)) as Record<string, unknown>;
    } catch {
      // Continue with empty registration if malformed
    }
  }

  // Update fields
  reg.image = imageUrl;

  // Update service endpoints by name
  const services = Array.isArray(reg.services)
    ? (reg.services as Array<Record<string, unknown>>)
    : [];
  for (const svc of services) {
    switch (svc.name) {
      case "A2A":
      case "OASF":
        svc.endpoint = a2aEndpoint;
        break;
      case "Web":
        svc.endpoint = webEndpoint;
        break;
    }
  }
  reg.services = services;

  // Upsert registration entry (deduplicate by agentRegistry)
  const registrations = Array.isArray(reg.registrations)
    ? (reg.registrations as Array<Record<string, unknown>>)
    : [];
  const newEntry = {
    agentId: Number(agentId),
    agentRegistry,
  };
  const filtered = registrations.filter(
    (r) => r.agentRegistry !== agentRegistry,
  );
  filtered.push(newEntry);
  reg.registrations = filtered;

  await writeFile(regFile, JSON.stringify(reg, null, 2));
}

// ── Subcommand: activate / deactivate ──────────────────────────

async function handleActivation(
  active: boolean,
  targetPath: string | undefined,
  context: CliContext,
): Promise<void> {
  const label = active ? "activate" : "deactivate";
  const pastLabel = active ? "activated" : "deactivated";

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

  // Read existing registration to find agentId and chain info
  const regFile = registrationPath(projectDir);
  if (!(await fileExists(regFile))) {
    context.log.error(
      "No agent-registration.json found. Run /register first to register your agent.",
    );
    return;
  }

  let reg: Record<string, unknown>;
  try {
    reg = JSON.parse(await readFile(regFile)) as Record<string, unknown>;
  } catch {
    context.log.error(
      "Could not parse agent-registration.json. Check that it is valid JSON.",
    );
    return;
  }

  // Check current active status
  const currentlyActive = reg.active !== false;
  if (active && currentlyActive) {
    context.log.info("Agent is already active.");
    return;
  }
  if (!active && !currentlyActive) {
    context.log.info("Agent is already deactivated.");
    return;
  }

  // Find registrations to determine which chain(s) to update on-chain
  const registrations = parseRegistrations(projectDir, reg);
  if (registrations.length === 0) {
    context.log.error(
      "No on-chain registrations found in agent-registration.json. Run /register first.",
    );
    return;
  }

  // Resolve all registrations to their chains
  const resolved: Array<{ entry: RegistrationEntry; chain: Erc8004Chain }> = [];
  for (const entry of registrations) {
    const parts = entry.agentRegistry.split(":");
    const chainId = parseInt(parts[1], 10);
    const chain = ERC8004_CHAINS.find((c) => c.chainId === chainId);
    if (!chain) {
      context.log.warn(
        `Skipping unknown chain ID ${chainId} in registration (Agent #${entry.agentId}).`,
      );
      continue;
    }
    resolved.push({ entry, chain });
  }

  if (resolved.length === 0) {
    context.log.error(
      `No known chains found in registrations. Cannot ${label} on-chain.`,
    );
    return;
  }

  console.log();
  context.log.info(
    `${active ? "Activating" : "Deactivating"} agent on ERC-8004`,
  );
  console.log();

  try {
    // Get private key
    const rawKey = await password({
      message: "Private key",
      mask: "*",
      theme: promptTheme,
    });

    const privateKey = (
      rawKey.startsWith("0x") ? rawKey : `0x${rawKey}`
    ) as Hex;

    let walletAddress: Hex;
    try {
      walletAddress = deriveAddress(privateKey);
    } catch {
      context.log.error("Invalid private key. Please check and try again.");
      return;
    }

    // Read agent URL from config
    const config = await readProjectConfig(projectDir);
    const agentUrl =
      config?.identity.url || config?.server.agentUrl || "";
    if (!agentUrl) {
      context.log.error(
        "Could not determine agent URL from project config.",
      );
      return;
    }

    // Summary and confirmation
    console.log();
    console.log(
      `  ${chalk.dim("Action:")}  ${label}`,
    );
    console.log(
      `  ${chalk.dim("Wallet:")}  ${walletAddress}`,
    );
    console.log(
      `  ${chalk.dim("Chains:")}  ${resolved.map(({ entry, chain }) => `Agent #${entry.agentId} on ${chain.name}`).join(", ")}`,
    );
    console.log();

    const proceed = await confirm({
      message: `Proceed with ${label} on ${resolved.length} chain${resolved.length > 1 ? "s" : ""}?`,
      default: true,
      theme: promptTheme,
    });

    if (!proceed) {
      context.log.dim("Cancelled.");
      return;
    }

    console.log();

    const totalSteps = 1 + resolved.length;

    // Step 1: Update local files
    const spinner1 = context.spinner(
      `Step 1/${totalSteps}  Updating registration files...`,
    );
    spinner1.start();
    try {
      await setRegistrationActive(projectDir, active);
      spinner1.succeed(
        `Step 1/${totalSteps}  Set active: ${active}`,
      );
    } catch (err) {
      spinner1.fail(`Step 1/${totalSteps}  Failed to update files`);
      context.log.error(
        err instanceof Error ? err.message : "File update failed.",
      );
      return;
    }

    // Steps 2..N: Call setAgentURI on each chain
    const agentURI = `${agentUrl}/.well-known/agent-registration.json`;
    const results: Array<{ chain: Erc8004Chain; agentId: number; txHash: string }> = [];

    for (let i = 0; i < resolved.length; i++) {
      const { entry, chain } = resolved[i];
      const step = i + 2;
      const spinnerN = context.spinner(
        `Step ${step}/${totalSteps}  setAgentURI() on ${chain.name}...`,
      );
      spinnerN.start();
      try {
        const result = await setAgentURI(
          privateKey,
          chain,
          BigInt(entry.agentId),
          agentURI,
        );
        spinnerN.succeed(
          `Step ${step}/${totalSteps}  ${chain.name} updated`,
        );
        results.push({ chain, agentId: entry.agentId, txHash: result.txHash });
      } catch (err) {
        spinnerN.fail(
          `Step ${step}/${totalSteps}  ${chain.name} failed`,
        );
        context.log.error(
          err instanceof Error ? err.message : "Transaction failed.",
        );
      }
    }

    // Final summary
    if (results.length > 0) {
      console.log();
      context.log.success(
        `Agent ${pastLabel} on ${results.length}/${resolved.length} chain${resolved.length > 1 ? "s" : ""}`,
      );
      console.log();
      for (const r of results) {
        console.log(
          `  ${chalk.dim(`Agent #${r.agentId} on ${r.chain.name}:`)} ${r.chain.explorerTxUrl}${r.txHash}`,
        );
      }
      console.log();
    }

    if (results.length < resolved.length) {
      context.log.warn(
        `${resolved.length - results.length} chain${resolved.length - results.length > 1 ? "s" : ""} failed. Re-run to retry.`,
      );
    }
  } catch (error) {
    if (error instanceof Error && error.name === "ExitPromptError") {
      console.log();
      context.log.dim("Cancelled.");
      return;
    }
    throw error;
  }
}

// ── Main command ───────────────────────────────────────────────

export const registerCommand: SlashCommand = {
  name: "register",
  description: "Register agent on-chain (ERC-8004)",
  aliases: ["reg"],
  usage: "/register [path]",
  order: 9,
  handler: async (args: string[], context: CliContext) => {
    const subcommand = args[0]?.toLowerCase();

    if (subcommand === "deactivate") {
      return handleActivation(false, args[1], context);
    }
    if (subcommand === "activate") {
      return handleActivation(true, args[1], context);
    }

    // Default: registration flow
    const targetPath = args[0];
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

    const config = await readProjectConfig(projectDir);
    if (!config) {
      context.log.error(
        "Could not read project configuration. Check that agent-card.json exists and is valid JSON.",
      );
      return;
    }

    // Validate agent quality before on-chain registration
    const issues = validateForRegistration(config);
    const errors = issues.filter((i) => i.level === "error");
    const warnings = issues.filter((i) => i.level === "warning");

    if (errors.length > 0 || warnings.length > 0) {
      console.log();
      context.log.info("Pre-registration checks:");
      console.log();
      for (const e of errors) context.log.error(e.message);
      for (const w of warnings) context.log.warn(w.message);
      console.log();
    }

    if (errors.length > 0) {
      context.log.error("Fix the issues above before registering.");
      return;
    }

    if (warnings.length > 0) {
      try {
        const proceed = await confirm({
          message: "Continue with registration?",
          default: false,
          theme: promptTheme,
        });
        if (!proceed) {
          context.log.dim("Cancelled.");
          return;
        }
      } catch (error) {
        if (error instanceof Error && error.name === "ExitPromptError") {
          console.log();
          context.log.dim("Cancelled.");
          return;
        }
        throw error;
      }
    }

    console.log();
    context.log.info("Registering agent on ERC-8004 Identity Registry");
    console.log();

    try {
      // 1. Select chain
      const chainId = await select({
        message: "Select network",
        choices: buildChainChoices(),
        default: 84532,
        theme: promptTheme,
      });

      const chain = ERC8004_CHAINS.find((c) => c.chainId === chainId);
      if (!chain) {
        context.log.error("Invalid chain selection.");
        return;
      }

      // 2. Private key
      const rawKey = await password({
        message: "Private key",
        mask: "*",
        theme: promptTheme,
      });

      const privateKey = (
        rawKey.startsWith("0x") ? rawKey : `0x${rawKey}`
      ) as Hex;

      // Validate key by deriving address
      let walletAddress: Hex;
      try {
        walletAddress = deriveAddress(privateKey);
      } catch {
        context.log.error(
          "Invalid private key. Please check and try again.",
        );
        return;
      }

      // 3. Agent URL
      const defaultUrl =
        config.identity.url || config.server.agentUrl || "";
      const agentUrl = await input({
        message: "Agent URL",
        default: defaultUrl,
        theme: promptTheme,
      });

      if (!agentUrl) {
        context.log.error("Agent URL is required.");
        return;
      }

      // 4. Summary and confirmation
      console.log();
      console.log(
        `  ${chalk.dim("Network:")}  ${chain.name} (${chain.chainId})`,
      );
      console.log(
        `  ${chalk.dim("Registry:")} ${chain.registry}`,
      );
      console.log(
        `  ${chalk.dim("RPC:")}      ${chain.rpcUrl}`,
      );
      console.log(
        `  ${chalk.dim("Wallet:")}   ${walletAddress}`,
      );
      console.log(
        `  ${chalk.dim("Agent:")}    ${agentUrl}`,
      );
      console.log();

      const proceed = await confirm({
        message: "Proceed with registration?",
        default: true,
        theme: promptTheme,
      });

      if (!proceed) {
        context.log.dim("Cancelled.");
        return;
      }

      console.log();

      // Step 1: Register on-chain
      const spinner1 = context.spinner("Step 1/3  Calling register()...");
      spinner1.start();
      let result;
      try {
        result = await registerAgent(privateKey, chain);
        spinner1.succeed(
          `Step 1/3  Agent minted (agentId: ${result.agentId})`,
        );
      } catch (err) {
        spinner1.fail("Step 1/3  register() failed");
        context.log.error(
          err instanceof Error ? err.message : "Transaction failed.",
        );
        return;
      }

      // Step 2: Update local files
      const spinner2 = context.spinner(
        "Step 2/3  Updating registration files...",
      );
      spinner2.start();
      try {
        await updateRegistrationFiles(
          projectDir,
          agentUrl,
          result.agentId,
          chain,
        );
        spinner2.succeed("Step 2/3  Registration files updated");
      } catch (err) {
        spinner2.fail("Step 2/3  Failed to update files");
        context.log.error(
          err instanceof Error ? err.message : "File update failed.",
        );
        return;
      }

      // Step 3: Set agent URI on-chain
      const agentURI = `${agentUrl}/.well-known/agent-registration.json`;
      const spinner3 = context.spinner("Step 3/3  Calling setAgentURI()...");
      spinner3.start();
      let uriResult;
      try {
        uriResult = await setAgentURI(
          privateKey,
          chain,
          result.agentId,
          agentURI,
        );
        spinner3.succeed("Step 3/3  Agent URI set on-chain");
      } catch (err) {
        spinner3.fail("Step 3/3  setAgentURI() failed");
        context.log.error(
          err instanceof Error ? err.message : "Transaction failed.",
        );
        return;
      }

      // Final summary
      const agentRegistry = `eip155:${chain.chainId}:${chain.registry}`;
      console.log();
      context.log.success("Agent registered on ERC-8004");
      console.log();
      console.log(
        `  ${chalk.dim("Agent ID:")}       ${result.agentId}`,
      );
      console.log(
        `  ${chalk.dim("Agent Registry:")} ${agentRegistry}`,
      );
      console.log(
        `  ${chalk.dim("Agent URI:")}      ${agentURI}`,
      );
      console.log(
        `  ${chalk.dim("TX 1:")}           ${chain.explorerTxUrl}${result.txHash}`,
      );
      console.log(
        `  ${chalk.dim("TX 2:")}           ${chain.explorerTxUrl}${uriResult.txHash}`,
      );
      console.log();
      context.log.dim(
        "Make sure your agent is deployed before clients attempt domain verification.",
      );
      console.log();
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

export const activateCommand: SlashCommand = {
  name: "activate",
  description: "Activate a registered agent on-chain (ERC-8004)",
  usage: "/activate [path]",
  order: 10,
  handler: async (args: string[], context: CliContext) => {
    return handleActivation(true, args[0], context);
  },
};

export const deactivateCommand: SlashCommand = {
  name: "deactivate",
  description: "Deactivate a registered agent on-chain (ERC-8004)",
  usage: "/deactivate [path]",
  order: 11,
  handler: async (args: string[], context: CliContext) => {
    return handleActivation(false, args[0], context);
  },
};
