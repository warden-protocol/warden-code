import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";

export interface BuildConfig {
  provider: "openai" | "anthropic";
  model: string;
  apiKey: string;
}

const CONFIG_DIR = ".warden";
const CONFIG_FILE = "config.json";

function configPath(): string {
  return path.join(os.homedir(), CONFIG_DIR, CONFIG_FILE);
}

export async function readConfig(): Promise<BuildConfig | null> {
  try {
    const content = await fs.readFile(configPath(), "utf-8");
    return JSON.parse(content) as BuildConfig;
  } catch {
    return null;
  }
}

export async function writeConfig(config: BuildConfig): Promise<void> {
  const dir = path.join(os.homedir(), CONFIG_DIR);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(configPath(), JSON.stringify(config, null, 2));
}
