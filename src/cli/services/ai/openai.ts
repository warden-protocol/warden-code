import OpenAI from "openai";
import type { AIProvider, Message } from "./provider.js";

export class OpenAIProvider implements AIProvider {
  private client: OpenAI;
  private model: string;

  constructor(apiKey: string, model: string) {
    this.client = new OpenAI({ apiKey });
    this.model = model;
  }

  private isCodexModel(): boolean {
    return this.model.includes("codex");
  }

  private splitMessages(messages: Message[]): {
    instructions: string;
    input: Array<{ role: "user" | "assistant"; content: string }>;
  } {
    const systemMessage = messages.find((m) => m.role === "system");
    const nonSystem = messages
      .filter((m) => m.role !== "system")
      .map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      }));
    return { instructions: systemMessage?.content || "", input: nonSystem };
  }

  async chat(messages: Message[]): Promise<string> {
    if (this.isCodexModel()) {
      const { instructions, input } = this.splitMessages(messages);
      const response = await this.client.responses.create({
        model: this.model,
        instructions,
        input,
      });
      return response.output_text;
    }

    const response = await this.client.chat.completions.create({
      model: this.model,
      messages: messages.map((m) => ({
        role: m.role as "system" | "user" | "assistant",
        content: m.content,
      })),
    });

    return response.choices[0]?.message?.content || "";
  }

  async *chatStream(messages: Message[]): AsyncIterable<string> {
    if (this.isCodexModel()) {
      const { instructions, input } = this.splitMessages(messages);
      const stream = await this.client.responses.create({
        model: this.model,
        instructions,
        input,
        stream: true,
      });

      for await (const event of stream) {
        if (event.type === "response.output_text.delta") {
          yield event.delta;
        }
      }
      return;
    }

    const stream = await this.client.chat.completions.create({
      model: this.model,
      stream: true,
      messages: messages.map((m) => ({
        role: m.role as "system" | "user" | "assistant",
        content: m.content,
      })),
    });

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content;
      if (delta) {
        yield delta;
      }
    }
  }
}
