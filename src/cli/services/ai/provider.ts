import type { BuildConfig } from "../config.js";
import { OpenAIProvider } from "./openai.js";
import { AnthropicProvider } from "./anthropic.js";

export interface Message {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface AIProvider {
  chat(messages: Message[]): Promise<string>;
  chatStream(messages: Message[]): AsyncIterable<string>;
}

export function createProvider(config: BuildConfig): AIProvider {
  switch (config.provider) {
    case "openai":
      return new OpenAIProvider(config.apiKey, config.model);
    case "anthropic":
      return new AnthropicProvider(config.apiKey, config.model);
  }
}

export function formatAPIError(error: unknown): string {
  const status = getStatusCode(error);
  const body = getErrorBody(error);

  if (status === 401) {
    return "Invalid API key. Use /model to reconfigure.";
  }

  if (status === 403) {
    return "Access denied. Your API key does not have permission for this model. Use /model to switch.";
  }

  if (status === 400) {
    if (body.includes("credit balance")) {
      return "Insufficient API credits. Top up your balance at your provider's billing page.";
    }
    if (body.includes("context length") || body.includes("too many tokens")) {
      return "The conversation is too long for this model. Start a new /build session.";
    }
    return `Bad request: ${body}`;
  }

  if (status === 404) {
    return "Model not found. Use /model to switch models.";
  }

  if (status === 429) {
    return "Rate limited. Wait a moment and try again.";
  }

  if (status !== undefined && status >= 500) {
    return "The provider is experiencing issues. Try again shortly.";
  }

  if (isConnectionError(error)) {
    return "Could not reach the provider. Check your internet connection.";
  }

  return String(error);
}

function getStatusCode(error: unknown): number | undefined {
  if (
    error != null &&
    typeof error === "object" &&
    "status" in error &&
    typeof (error as Record<string, unknown>).status === "number"
  ) {
    return (error as Record<string, unknown>).status as number;
  }
  return undefined;
}

function getErrorBody(error: unknown): string {
  if (error != null && typeof error === "object" && "error" in error) {
    const body = (error as Record<string, unknown>).error;
    if (typeof body === "string") return body;
    if (body != null && typeof body === "object") {
      const msg = (body as Record<string, unknown>).message;
      if (typeof msg === "string") return msg;
      return JSON.stringify(body);
    }
  }
  if (error instanceof Error) return error.message;
  return String(error);
}

function isConnectionError(error: unknown): boolean {
  if (error instanceof Error) {
    const name = error.constructor.name;
    return (
      name === "APIConnectionError" || name === "APIConnectionTimeoutError"
    );
  }
  return false;
}
