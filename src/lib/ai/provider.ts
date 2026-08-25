import OpenAI from "openai";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";

export type AiProvider = "openai" | "siliconflow" | "none";

let chatClient: OpenAI | null = null;
let clientProvider: AiProvider | null = null;

export function resolveProvider(): AiProvider {
  const explicit = (process.env.AI_PROVIDER ?? "").toLowerCase();
  if (explicit === "openai") {
    return process.env.OPENAI_API_KEY ? "openai" : "none";
  }
  if (explicit === "siliconflow" || explicit === "silicon") {
    return process.env.SILICONFLOW_API_KEY ? "siliconflow" : "none";
  }
  if (process.env.SILICONFLOW_API_KEY) return "siliconflow";
  if (process.env.OPENAI_API_KEY) return "openai";
  return "none";
}

export function providerLabel() {
  const provider = resolveProvider();
  if (provider === "siliconflow") return "siliconflow";
  if (provider === "openai") return "openai";
  return "local";
}

export function getChatClient() {
  const provider = resolveProvider();
  if (provider === "none") return null;
  if (chatClient && clientProvider === provider) return chatClient;

  const apiKey =
    provider === "siliconflow"
      ? process.env.SILICONFLOW_API_KEY
      : process.env.OPENAI_API_KEY;
  const baseURL =
    provider === "siliconflow"
      ? process.env.SILICONFLOW_BASE_URL || "https://api.siliconflow.cn/v1"
      : process.env.OPENAI_BASE_URL || undefined;

  chatClient = new OpenAI({
    apiKey,
    baseURL,
  });
  clientProvider = provider;
  return chatClient;
}

export function getChatModel() {
  if (resolveProvider() === "siliconflow") {
    return process.env.SILICONFLOW_MODEL || "deepseek-ai/DeepSeek-V3";
  }
  return process.env.OPENAI_MODEL || "gpt-4o-mini";
}

export function getEmbeddingModel() {
  if (resolveProvider() === "siliconflow") {
    return (
      process.env.SILICONFLOW_EMBEDDING_MODEL || "BAAI/bge-m3"
    );
  }
  return process.env.EMBEDDING_MODEL || "text-embedding-3-small";
}

export function embeddingDimensions() {
  const override = Number(process.env.EMBEDDING_DIMENSIONS);
  if (Number.isFinite(override) && override > 0) return override;
  return resolveProvider() === "siliconflow" ? 1024 : 1536;
}

export function hasChatProvider() {
  return resolveProvider() !== "none";
}

export async function createChatCompletion({
  messages,
  temperature = 0.1,
  responseFormat,
}: {
  messages: ChatCompletionMessageParam[];
  temperature?: number;
  responseFormat?: "json_object";
}) {
  const client = getChatClient();
  if (!client) throw new Error("No chat provider configured");
  const common = {
    model: getChatModel(),
    messages,
    temperature,
  };
  try {
    if (responseFormat) {
      return await client.chat.completions.create({
        ...common,
        response_format: { type: responseFormat },
      });
    }
    return await client.chat.completions.create(common);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (responseFormat && /response_format|json object|not supported/i.test(message)) {
      return client.chat.completions.create(common);
    }
    throw error;
  }
}
