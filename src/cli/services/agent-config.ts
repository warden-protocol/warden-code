import * as path from "node:path";
import { readFile, writeFile, fileExists } from "./project.js";

// ── Types ──────────────────────────────────────────────────────

export interface AgentCardSkill {
  id: string;
  name: string;
  description: string;
  tags: string[];
}

export interface AgentProjectConfig {
  server: {
    host: string;
    port: string;
    agentUrl: string;
    openaiApiKey?: string;
    openaiModel?: string;
  };
  identity: {
    name: string;
    description: string;
    url: string;
    version: string;
  };
  skills: AgentCardSkill[];
  payments: {
    enabled: boolean;
    facilitatorUrl?: string;
    networks: Array<{
      prefix: string;
      network: string;
      payTo: string;
      price: string;
    }>;
    x402Support: boolean;
    x402Networks: string[];
  };
}

// ── Known x402 network prefixes ────────────────────────────────

const NETWORK_PREFIXES: Record<string, string> = {
  "eip155:84532": "X402_BASE_SEPOLIA",
  "eip155:8453": "X402_BASE",
};

// ── .env parsing ───────────────────────────────────────────────

export function parseEnv(content: string): Map<string, string> {
  const env = new Map<string, string>();
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIndex = trimmed.indexOf("=");
    if (eqIndex === -1) continue;
    const key = trimmed.slice(0, eqIndex).trim();
    const value = trimmed.slice(eqIndex + 1).trim();
    env.set(key, value);
  }
  return env;
}

export function serializeEnv(
  original: string,
  updates: Map<string, string>,
  removals?: Set<string>,
): string {
  const handled = new Set<string>();
  const lines = original
    .split("\n")
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) return line;
      const eqIndex = trimmed.indexOf("=");
      if (eqIndex === -1) return line;
      const key = trimmed.slice(0, eqIndex).trim();
      if (removals?.has(key)) {
        handled.add(key);
        return null;
      }
      if (updates.has(key)) {
        handled.add(key);
        return `${key}=${updates.get(key)}`;
      }
      return line;
    })
    .filter((line): line is string => line !== null);

  // Append new keys that were not already in the file
  for (const [key, value] of updates) {
    if (!handled.has(key)) {
      lines.push(`${key}=${value}`);
    }
  }

  return lines.join("\n");
}

// ── File paths ─────────────────────────────────────────────────

function envPath(projectDir: string): string {
  return path.join(projectDir, ".env");
}

function agentCardPath(projectDir: string): string {
  return path.join(projectDir, "public", ".well-known", "agent-card.json");
}

export function registrationPath(projectDir: string): string {
  return path.join(
    projectDir,
    "public",
    ".well-known",
    "agent-registration.json",
  );
}

// ── Read ───────────────────────────────────────────────────────

export async function readProjectConfig(
  projectDir: string,
): Promise<AgentProjectConfig | null> {
  // Read .env
  const dotEnvPath = envPath(projectDir);
  const hasEnv = await fileExists(dotEnvPath);
  const env = hasEnv ? parseEnv(await readFile(dotEnvPath)) : new Map<string, string>();

  // Read agent-card.json
  const cardPath = agentCardPath(projectDir);
  const hasCard = await fileExists(cardPath);
  if (!hasCard) return null;

  let card: Record<string, unknown>;
  try {
    card = JSON.parse(await readFile(cardPath)) as Record<string, unknown>;
  } catch {
    return null;
  }

  // Read agent-registration.json
  const regPath = registrationPath(projectDir);
  const hasReg = await fileExists(regPath);
  let reg: Record<string, unknown> = {};
  if (hasReg) {
    try {
      reg = JSON.parse(await readFile(regPath)) as Record<string, unknown>;
    } catch {
      // Continue with empty registration if malformed
    }
  }

  // Discover payment networks from .env
  const networks: AgentProjectConfig["payments"]["networks"] = [];
  for (const [networkId, prefix] of Object.entries(NETWORK_PREFIXES)) {
    const payTo = env.get(`${prefix}_PAY_TO`);
    if (payTo) {
      networks.push({
        prefix,
        network: env.get(`${prefix}_NETWORK`) || networkId,
        payTo,
        price: env.get(`${prefix}_PRICE`) || "0.01",
      });
    }
  }

  // Read skills from agent card
  const rawSkills = Array.isArray(card.skills) ? card.skills : [];
  const skills: AgentCardSkill[] = rawSkills.map(
    (s: Record<string, unknown>) => ({
      id: (s.id as string) || "",
      name: (s.name as string) || "",
      description: (s.description as string) || "",
      tags: Array.isArray(s.tags) ? (s.tags as string[]) : [],
    }),
  );

  return {
    server: {
      host: env.get("HOST") || "localhost",
      port: env.get("PORT") || "3000",
      agentUrl: env.get("AGENT_URL") || "http://localhost:3000",
      openaiApiKey: env.get("OPENAI_API_KEY"),
      openaiModel: env.get("OPENAI_MODEL"),
    },
    identity: {
      name: (card.name as string) || "",
      description: (card.description as string) || "",
      url: (card.url as string) || "",
      version: (card.version as string) || "0.1.0",
    },
    skills,
    payments: {
      enabled: networks.length > 0,
      facilitatorUrl: env.get("X402_FACILITATOR_URL"),
      networks,
      x402Support: (reg.x402Support as boolean) ?? false,
      x402Networks: (reg.x402Networks as string[]) ?? [],
    },
  };
}

// ── Write: server (.env) ───────────────────────────────────────

export async function writeServerConfig(
  projectDir: string,
  server: AgentProjectConfig["server"],
): Promise<void> {
  const dotEnvPath = envPath(projectDir);
  const original = (await fileExists(dotEnvPath))
    ? await readFile(dotEnvPath)
    : "";

  const updates = new Map<string, string>([
    ["HOST", server.host],
    ["PORT", server.port],
    ["AGENT_URL", server.agentUrl],
  ]);
  if (server.openaiApiKey !== undefined) {
    updates.set("OPENAI_API_KEY", server.openaiApiKey);
  }
  if (server.openaiModel !== undefined) {
    updates.set("OPENAI_MODEL", server.openaiModel);
  }

  await writeFile(dotEnvPath, serializeEnv(original, updates));
}

// ── Write: identity (agent-card.json + registration) ───────────

export async function writeIdentityConfig(
  projectDir: string,
  identity: AgentProjectConfig["identity"],
): Promise<void> {
  // Update agent-card.json
  const cardFile = agentCardPath(projectDir);
  let card: Record<string, unknown> = {};
  if (await fileExists(cardFile)) {
    try {
      card = JSON.parse(await readFile(cardFile)) as Record<string, unknown>;
    } catch {
      // Start fresh if malformed
    }
  }
  card.name = identity.name;
  card.description = identity.description;
  card.url = identity.url;
  card.version = identity.version;
  await writeFile(cardFile, JSON.stringify(card, null, 2) + "\n");

  // Update agent-registration.json
  const regFile = registrationPath(projectDir);
  let reg: Record<string, unknown> = {};
  if (await fileExists(regFile)) {
    try {
      reg = JSON.parse(await readFile(regFile)) as Record<string, unknown>;
    } catch {
      // Start fresh if malformed
    }
  }
  reg.name = identity.name;
  reg.description = identity.description;
  await writeFile(regFile, JSON.stringify(reg, null, 2) + "\n");
}

// ── Write: skills (agent-card.json) ────────────────────────────

export async function writeSkillsConfig(
  projectDir: string,
  skills: AgentCardSkill[],
): Promise<void> {
  const cardFile = agentCardPath(projectDir);
  let card: Record<string, unknown> = {};
  if (await fileExists(cardFile)) {
    try {
      card = JSON.parse(await readFile(cardFile)) as Record<string, unknown>;
    } catch {
      // Start fresh if malformed
    }
  }
  card.skills = skills;
  await writeFile(cardFile, JSON.stringify(card, null, 2) + "\n");
}

// ── Write: payments (.env + registration) ──────────────────────

export async function writePaymentConfig(
  projectDir: string,
  payments: AgentProjectConfig["payments"],
): Promise<void> {
  // Build updates and removals for .env
  const dotEnvPath = envPath(projectDir);
  const original = (await fileExists(dotEnvPath))
    ? await readFile(dotEnvPath)
    : "";

  const updates = new Map<string, string>();
  const removals = new Set<string>();

  if (payments.networks.length > 0 && payments.facilitatorUrl) {
    updates.set("X402_FACILITATOR_URL", payments.facilitatorUrl);
  } else {
    removals.add("X402_FACILITATOR_URL");
  }

  // Track which prefixes are active
  const activePrefixes = new Set(payments.networks.map((n) => n.prefix));

  for (const net of payments.networks) {
    updates.set(`${net.prefix}_PAY_TO`, net.payTo);
    updates.set(`${net.prefix}_PRICE`, net.price);
    updates.set(`${net.prefix}_NETWORK`, net.network);
  }

  // Remove keys for inactive network prefixes
  for (const prefix of Object.values(NETWORK_PREFIXES)) {
    if (!activePrefixes.has(prefix)) {
      removals.add(`${prefix}_PAY_TO`);
      removals.add(`${prefix}_PRICE`);
      removals.add(`${prefix}_NETWORK`);
    }
  }

  await writeFile(dotEnvPath, serializeEnv(original, updates, removals));

  // Update agent-registration.json
  const regFile = registrationPath(projectDir);
  let reg: Record<string, unknown> = {};
  if (await fileExists(regFile)) {
    try {
      reg = JSON.parse(await readFile(regFile)) as Record<string, unknown>;
    } catch {
      // Start fresh if malformed
    }
  }
  reg.x402Support = payments.x402Support;
  reg.x402Networks = payments.x402Networks;
  await writeFile(regFile, JSON.stringify(reg, null, 2) + "\n");
}
