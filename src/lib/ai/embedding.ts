import {
  embeddingDimensions,
  getChatClient,
  getEmbeddingModel,
} from "./provider";

const EMBEDDING_DIMENSIONS = embeddingDimensions();

function tokenize(text: string) {
  const normalized = text.toLowerCase().trim();
  const words = normalized.match(/[a-z0-9]+|[\u4e00-\u9fff]|[\u3040-\u30ff]|[^\s\w]/g) ?? [];
  const tokens = [...words];
  for (let index = 0; index < words.length - 1; index += 1) {
    const pair = `${words[index]} ${words[index + 1]}`;
    if (pair.length <= 24) tokens.push(pair);
  }
  return tokens;
}

function hashToken(token: string) {
  let hash = 2166136261;
  for (let index = 0; index < token.length; index += 1) {
    hash ^= token.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function localEmbedding(text: string) {
  const vector = new Array<number>(EMBEDDING_DIMENSIONS).fill(0);
  const tokens = tokenize(text);
  for (const token of tokens) {
    const index = hashToken(token) % EMBEDDING_DIMENSIONS;
    vector[index] += 1;
  }
  const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
  if (norm === 0) return vector;
  return vector.map((value) => value / norm);
}

export async function getEmbedding(text: string) {
  const client = getChatClient();
  if (client) {
    try {
      const response = await client.embeddings.create({
        model: getEmbeddingModel(),
        input: text.slice(0, 7000),
      });
      return response.data[0].embedding;
    } catch (error) {
      console.error(
        `Embedding request failed (${getEmbeddingModel()}), using local embedding`,
        error,
      );
    }
  }
  return localEmbedding(text);
}

export function hasEmbeddingProvider() {
  return Boolean(getChatClient());
}

export function cosineSimilarity(a: number[], b: number[]) {
  if (!a || !b || a.length !== b.length) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let index = 0; index < a.length; index += 1) {
    dot += a[index] * b[index];
    normA += a[index] * a[index];
    normB += b[index] * b[index];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}
