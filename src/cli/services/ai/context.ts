import * as fs from "node:fs/promises";
import * as path from "node:path";
import { writeFile } from "../project.js";

const PROJECT_FILES = [
  "src/agent.ts",
  "src/server.ts",
  "package.json",
  ".env.example",
];

export async function buildProjectContext(
  projectDir: string,
): Promise<string> {
  const sections: string[] = [];

  for (const file of PROJECT_FILES) {
    try {
      const content = await fs.readFile(
        path.join(projectDir, file),
        "utf-8",
      );
      sections.push(`--- ${file} ---\n${content}`);
    } catch {
      // File may not exist, skip it
    }
  }

  return sections.join("\n\n");
}

export interface FileChange {
  filePath: string;
  content: string;
}

export function parseResponse(response: string): {
  text: string;
  changes: FileChange[];
} {
  const changes: FileChange[] = [];
  // Match code blocks with file path annotation: ```language:path
  const codeBlockRegex = /```\w+:([^\n]+)\n([\s\S]*?)```/g;
  let match;

  while ((match = codeBlockRegex.exec(response)) !== null) {
    changes.push({
      filePath: match[1]!.trim(),
      content: match[2]!,
    });
  }

  // Strip code blocks from response to get explanation text
  const text = response
    .replace(/```\w+:[^\n]+\n[\s\S]*?```/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return { text, changes };
}

export async function applyChanges(
  projectDir: string,
  changes: FileChange[],
): Promise<string[]> {
  const applied: string[] = [];

  for (const change of changes) {
    const fullPath = path.join(projectDir, change.filePath);
    await writeFile(fullPath, change.content);
    applied.push(change.filePath);
  }

  return applied;
}

export const SYSTEM_PROMPT = `You are an expert AI agent developer. You help users build and modify agents built with the @wardenprotocol/agent-kit package.

The user has a scaffolded agent project. You will receive the current project files as context.

When the user asks you to make changes, respond with:
1. A brief explanation of what you're changing and why
2. The updated file contents using code blocks tagged with the file path

Format code changes like this:
\`\`\`typescript:src/agent.ts
// full updated file content here
\`\`\`

Important rules:
- Always include the COMPLETE file content in code blocks, not just the changed parts
- Only include code blocks for files you are actually modifying
- The agent handler is in src/agent.ts — this is the main file users work on
- The server setup is in src/server.ts — only modify this if the user specifically asks for server changes
- If the user needs new npm packages, mention them and update package.json
- Keep code clean, well-typed, and following TypeScript best practices
- The project uses ES modules ("type": "module") with NodeNext module resolution
`;
