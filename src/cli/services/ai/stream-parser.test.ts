import { describe, it, expect } from "vitest";
import { StreamParser, type StreamEvent } from "./stream-parser.js";

/** Feed all deltas and flush, returning the full event list. */
function feedAll(deltas: string[]): StreamEvent[] {
  const parser = new StreamParser();
  const events: StreamEvent[] = [];
  for (const d of deltas) {
    events.push(...parser.feed(d));
  }
  events.push(...parser.flush());
  return events;
}

/** Extract concatenated text from text events. */
function textContent(events: StreamEvent[]): string {
  return events
    .filter((e) => e.type === "text")
    .map((e) => (e as { type: "text"; content: string }).content)
    .join("");
}

describe("StreamParser", () => {
  describe("plain text (no code blocks)", () => {
    it("should emit all text as text events", () => {
      const events = feedAll(["Hello ", "world!"]);
      expect(events.every((e) => e.type === "text")).toBe(true);
      expect(textContent(events)).toBe("Hello world!");
    });

    it("should handle a single character at a time", () => {
      const chars = "Hello".split("");
      const events = feedAll(chars);
      expect(textContent(events)).toBe("Hello");
    });

    it("should handle empty deltas", () => {
      const events = feedAll(["", "hi", "", "!"]);
      expect(textContent(events)).toBe("hi!");
    });
  });

  describe("single annotated code block", () => {
    it("should emit file_start and file_end with content", () => {
      const events = feedAll([
        "Here is the change:\n",
        "```typescript:src/agent.ts\n",
        "const x = 1;\n",
        "```\n",
      ]);

      const fileStarts = events.filter((e) => e.type === "file_start");
      const fileEnds = events.filter((e) => e.type === "file_end");

      expect(fileStarts).toHaveLength(1);
      expect(fileStarts[0]).toEqual({
        type: "file_start",
        filePath: "src/agent.ts",
      });

      expect(fileEnds).toHaveLength(1);
      expect(fileEnds[0]).toEqual({
        type: "file_end",
        filePath: "src/agent.ts",
        content: "const x = 1;\n",
      });

      expect(textContent(events)).toBe("Here is the change:\n");
    });

    it("should handle code block with multiple lines", () => {
      const code = 'import fs from "fs";\n\nconst data = fs.readFileSync("x");\nconsole.log(data);\n';
      const events = feedAll([
        "```typescript:src/main.ts\n",
        code,
        "```\n",
      ]);

      const fileEnd = events.find((e) => e.type === "file_end") as {
        type: "file_end";
        content: string;
      };
      expect(fileEnd.content).toBe(code);
    });
  });

  describe("multiple code blocks", () => {
    it("should handle two code blocks with text between them", () => {
      const events = feedAll([
        "First change:\n",
        "```typescript:src/a.ts\nconst a = 1;\n```\n",
        "Second change:\n",
        "```typescript:src/b.ts\nconst b = 2;\n```\n",
        "Done.",
      ]);

      const fileStarts = events.filter((e) => e.type === "file_start");
      const fileEnds = events.filter((e) => e.type === "file_end");

      expect(fileStarts).toHaveLength(2);
      expect(fileStarts[0]).toEqual({ type: "file_start", filePath: "src/a.ts" });
      expect(fileStarts[1]).toEqual({ type: "file_start", filePath: "src/b.ts" });

      expect(fileEnds).toHaveLength(2);
      expect((fileEnds[0] as { content: string }).content).toBe("const a = 1;\n");
      expect((fileEnds[1] as { content: string }).content).toBe("const b = 2;\n");

      expect(textContent(events)).toBe("First change:\nSecond change:\nDone.");
    });
  });

  describe("fence split across tokens", () => {
    it("should detect fence when backticks and path arrive in separate tokens", () => {
      const events = feedAll([
        "Change:\n",
        "```",
        "typescript:",
        "src/agent.ts",
        "\n",
        "const x = 1;\n",
        "```",
        "\n",
      ]);

      const fileStarts = events.filter((e) => e.type === "file_start");
      expect(fileStarts).toHaveLength(1);
      expect(fileStarts[0]).toEqual({
        type: "file_start",
        filePath: "src/agent.ts",
      });
    });

    it("should detect fence one character at a time", () => {
      const full = "```typescript:src/agent.ts\ncode\n```\n";
      const events = feedAll(full.split(""));

      const fileStarts = events.filter((e) => e.type === "file_start");
      const fileEnds = events.filter((e) => e.type === "file_end");
      expect(fileStarts).toHaveLength(1);
      expect(fileEnds).toHaveLength(1);
      expect((fileEnds[0] as { content: string }).content).toBe("code\n");
    });
  });

  describe("inline backticks (not fences)", () => {
    it("should pass single backticks through as text", () => {
      const events = feedAll(["Use `variable` in your code."]);
      expect(textContent(events)).toBe("Use `variable` in your code.");
      expect(events.every((e) => e.type === "text")).toBe(true);
    });

    it("should pass double backticks through as text", () => {
      const events = feedAll(["Use ``code`` here."]);
      expect(textContent(events)).toBe("Use ``code`` here.");
    });
  });

  describe("generic code block (no :path annotation)", () => {
    it("should pass through as text events", () => {
      const events = feedAll([
        "Example:\n",
        "```typescript\n",
        "const x = 1;\n",
        "```\n",
        "End.",
      ]);

      expect(events.every((e) => e.type === "text")).toBe(true);
      expect(textContent(events)).toBe(
        "Example:\n```typescript\nconst x = 1;\n```\nEnd.",
      );
    });

    it("should handle generic code block followed by annotated block", () => {
      const events = feedAll([
        "```bash\nnpm install\n```\n",
        "```typescript:src/agent.ts\nconst x = 1;\n```\n",
      ]);

      const fileStarts = events.filter((e) => e.type === "file_start");
      expect(fileStarts).toHaveLength(1);
      expect(fileStarts[0]).toEqual({
        type: "file_start",
        filePath: "src/agent.ts",
      });
      expect(textContent(events)).toContain("npm install");
    });
  });

  describe("backticks inside code blocks", () => {
    it("should not trigger false close from template literals", () => {
      const code = "const msg = `Hello ${name}`;\nconsole.log(msg);\n";
      const events = feedAll([
        "```typescript:src/agent.ts\n",
        code,
        "```\n",
      ]);

      const fileEnds = events.filter((e) => e.type === "file_end");
      expect(fileEnds).toHaveLength(1);
      expect((fileEnds[0] as { content: string }).content).toBe(code);
    });

    it("should not trigger false close from backticks mid-line", () => {
      const code = 'const x = ``` + "not a fence";\n';
      const events = feedAll([
        "```typescript:src/agent.ts\n",
        code,
        "```\n",
      ]);

      const fileEnds = events.filter((e) => e.type === "file_end");
      expect(fileEnds).toHaveLength(1);
      // The ``` mid-line gets included in code content
      expect((fileEnds[0] as { content: string }).content).toContain("```");
    });
  });

  describe("empty code block", () => {
    it("should emit file_start and file_end with empty content", () => {
      const events = feedAll(["```typescript:src/empty.ts\n```\n"]);

      const fileStarts = events.filter((e) => e.type === "file_start");
      const fileEnds = events.filter((e) => e.type === "file_end");
      expect(fileStarts).toHaveLength(1);
      expect(fileEnds).toHaveLength(1);
      expect((fileEnds[0] as { content: string }).content).toBe("");
    });
  });

  describe("flush with incomplete state", () => {
    it("should flush incomplete opening fence as text", () => {
      const parser = new StreamParser();
      const events = [...parser.feed("text ```typ"), ...parser.flush()];

      expect(textContent(events)).toBe("text ```typ");
      expect(events.every((e) => e.type === "text")).toBe(true);
    });

    it("should flush incomplete code block as file_end", () => {
      const parser = new StreamParser();
      const events = [
        ...parser.feed("```typescript:src/agent.ts\npartial code"),
        ...parser.flush(),
      ];

      const fileEnds = events.filter((e) => e.type === "file_end");
      expect(fileEnds).toHaveLength(1);
      expect((fileEnds[0] as { content: string }).content).toBe("partial code");
    });

    it("should flush closing fence at end of stream", () => {
      const parser = new StreamParser();
      const events = [
        ...parser.feed("```typescript:src/agent.ts\ncode\n```"),
        ...parser.flush(),
      ];

      const fileEnds = events.filter((e) => e.type === "file_end");
      expect(fileEnds).toHaveLength(1);
      expect((fileEnds[0] as { content: string }).content).toBe("code\n");
    });
  });

  describe("getFullResponse", () => {
    it("should return complete response including code blocks", () => {
      const parser = new StreamParser();
      parser.feed("Explanation.\n");
      parser.feed("```typescript:src/agent.ts\nconst x = 1;\n```\n");
      parser.feed("Done.");
      parser.flush();

      expect(parser.getFullResponse()).toBe(
        "Explanation.\n```typescript:src/agent.ts\nconst x = 1;\n```\nDone.",
      );
    });

    it("should work with plain text only", () => {
      const parser = new StreamParser();
      parser.feed("Just text.");
      parser.flush();
      expect(parser.getFullResponse()).toBe("Just text.");
    });
  });

  describe("edge cases", () => {
    it("should handle code block with json language tag", () => {
      const events = feedAll([
        "```json:package.json\n",
        '{"name": "test"}\n',
        "```\n",
      ]);

      const fileStarts = events.filter((e) => e.type === "file_start");
      expect(fileStarts[0]).toEqual({
        type: "file_start",
        filePath: "package.json",
      });
    });

    it("should handle file paths with dots and slashes", () => {
      const events = feedAll([
        "```typescript:src/services/ai/provider.ts\ncode\n```\n",
      ]);

      const fileStarts = events.filter((e) => e.type === "file_start");
      expect(fileStarts[0]).toEqual({
        type: "file_start",
        filePath: "src/services/ai/provider.ts",
      });
    });

    it("should handle code block immediately at start", () => {
      const events = feedAll([
        "```typescript:src/agent.ts\nconst x = 1;\n```\n",
      ]);

      const fileStarts = events.filter((e) => e.type === "file_start");
      expect(fileStarts).toHaveLength(1);
    });

    it("should handle response with only a code block", () => {
      const events = feedAll([
        "```typescript:src/agent.ts\nconst x = 1;\n```\n",
      ]);

      expect(textContent(events)).toBe("");
      const fileEnds = events.filter((e) => e.type === "file_end");
      expect(fileEnds).toHaveLength(1);
    });
  });
});
