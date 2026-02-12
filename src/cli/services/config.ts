import * as fs from "node:fs/promises";
import * as path from "node:path";

export interface BuildConfig {
  provider: "openai" | "anthropic";
  model: string;
  apiKey: string;
}

const CONFIG_DIR = ".warden";
const CONFIG_FILE = "config.json";

function configPath(projectDir: string): string {
  return path.join(projectDir, CONFIG_DIR, CONFIG_FILE);
}

export async function readConfig(
  projectDir: string,
): Promise<BuildConfig | null> {
  try {
    const content = await fs.readFile(configPath(projectDir), "utf-8");
    return JSON.parse(content) as BuildConfig;
  } catch {
    return null;
  }
}

export async function writeConfig(
  projectDir: string,
  config: BuildConfig,
): Promise<void> {
  const dir = path.join(projectDir, CONFIG_DIR);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(configPath(projectDir), JSON.stringify(config, null, 2));
}
