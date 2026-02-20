import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ProviderName = "openai" | "anthropic";

/** Per-provider credentials and last-used model. */
export interface ProviderConfig {
  apiKey: string;
  model: string;
}

/** On-disk format: stores all configured providers with one marked active. */
export interface MultiProviderConfig {
  active: string; // "provider/model"
  providers: Partial<Record<ProviderName, ProviderConfig>>;
}

/** Active-provider view consumed by createProvider() and the build loop. */
export interface BuildConfig {
  provider: ProviderName;
  model: string;
  apiKey: string;
}

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

export function activeKey(provider: ProviderName, model: string): string {
  return `${provider}/${model}`;
}

export function parseActive(active: string): {
  provider: ProviderName;
  model: string;
} {
  const slash = active.indexOf("/");
  return {
    provider: active.slice(0, slash) as ProviderName,
    model: active.slice(slash + 1),
  };
}

export function toBuildConfig(multi: MultiProviderConfig): BuildConfig | null {
  const { provider, model } = parseActive(multi.active);
  const entry = multi.providers[provider];
  if (!entry) return null;
  return { provider, model, apiKey: entry.apiKey };
}

export function updateProvider(
  multi: MultiProviderConfig,
  provider: ProviderName,
  model: string,
  apiKey: string,
): MultiProviderConfig {
  return {
    active: activeKey(provider, model),
    providers: {
      ...multi.providers,
      [provider]: { apiKey, model },
    },
  };
}

// ---------------------------------------------------------------------------
// I/O
// ---------------------------------------------------------------------------

const CONFIG_DIR = ".warden";
const CONFIG_FILE = "config.json";

function configPath(): string {
  return path.join(os.homedir(), CONFIG_DIR, CONFIG_FILE);
}

export async function readMultiConfig(): Promise<MultiProviderConfig | null> {
  try {
    const content = await fs.readFile(configPath(), "utf-8");
    const parsed = JSON.parse(content) as Record<string, unknown>;

    // New format
    if (parsed.providers) {
      return parsed as unknown as MultiProviderConfig;
    }

    // Legacy format: flat { provider, model, apiKey }
    if (parsed.provider && parsed.model && parsed.apiKey) {
      const legacy = parsed as unknown as BuildConfig;
      const migrated: MultiProviderConfig = {
        active: activeKey(legacy.provider, legacy.model),
        providers: {
          [legacy.provider]: {
            apiKey: legacy.apiKey,
            model: legacy.model,
          },
        },
      };
      await writeConfig(migrated);
      return migrated;
    }

    return null;
  } catch {
    return null;
  }
}

export async function readConfig(): Promise<BuildConfig | null> {
  const multi = await readMultiConfig();
  if (!multi) return null;
  return toBuildConfig(multi);
}

export async function writeConfig(config: MultiProviderConfig): Promise<void> {
  const dir = path.join(os.homedir(), CONFIG_DIR);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(configPath(), JSON.stringify(config, null, 2));
}
