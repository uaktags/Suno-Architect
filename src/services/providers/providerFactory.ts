import { AIProvider, AIProviderConfig } from "../../types";
import { GeminiProvider } from "./geminiProvider";
import { OpenRouterProvider } from "./openRouterProvider";
import { OpenAPIProvider } from "./openApiProvider";

export function createProvider(config: AIProviderConfig): AIProvider {
  switch (config.type) {
    case "gemini":
      return new GeminiProvider(config);
    case "openrouter":
      return new OpenRouterProvider(config);
    case "openapi":
      return new OpenAPIProvider(config);
    default:
      throw new Error(`Unknown provider type: ${config.type}`);
  }
}

export function getDefaultModelForProvider(type: AIProviderConfig["type"]): string {
  switch (type) {
    case "gemini":
      return "gemini-3-flash-preview";
    case "openrouter":
      return "openai/gpt-4o-mini";
    case "openapi":
      return "gpt-4o-mini";
    default:
      return "gemini-3-flash-preview";
  }
}

const HIGH_CONTEXT_OPENROUTER_MODEL_PATTERNS = [
  /gpt-4\.1/i,
  /gpt-4o/i,
  /o1/i,
  /o3/i,
  /claude-3\.5/i,
  /claude-3\.7/i,
  /claude-sonnet-4/i,
  /gemini-1\.5/i,
  /gemini-2\.[05]/i,
  /llama-3\.1-70b/i,
  /llama-3\.1-405b/i,
  /qwen2\.5-72b/i,
  /deepseek-r1/i,
];

export function getMaxTracksForProvider(config?: AIProviderConfig): number {
  if (!config) return 7;

  if (config.type !== "openrouter") {
    return 7;
  }

  const model = (config.model || "").trim();
  if (!model) {
    return 10;
  }

  const highContext = HIGH_CONTEXT_OPENROUTER_MODEL_PATTERNS.some((pattern) =>
    pattern.test(model)
  );

  return highContext ? 15 : 10;
}

export function validateProviderConfig(config: AIProviderConfig): boolean {
  if (!config || !config.type) {
    return false;
  }

  switch (config.type) {
    case "gemini":
      return !!config.apiKey && !!config.model;
    case "openrouter":
      return !!config.apiKey && !!config.model;
    case "openapi":
      return !!config.baseUrl && !!config.model;
    default:
      return false;
  }
}
