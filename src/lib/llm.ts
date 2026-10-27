import ZAI from "z-ai-web-dev-sdk";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { DEFAULT_MODELS } from "./model-fallbacks";
import { getRequestProviderKeys } from "./request-context";

export { providerModels, FREE_MODELS } from "./model-fallbacks";

export type ProviderId = "zai" | "openai" | "google" | "anthropic" | "openrouter";

type Message = { role: "system" | "user" | "assistant"; content: string };

export interface ProviderChunk {
  content?: string;
  reasoning?: string;
}

export class ProviderError extends Error {
  constructor(
    message: string,
    public readonly provider: ProviderId,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "ProviderError";
  }

  get isRateLimit(): boolean {
    return this.status === 429 || /(?:status\s*)?429|rate.?limit|too many requests/i.test(this.message);
  }

  /** Errors where trying another model (or provider) may succeed. */
  get isRetryable(): boolean {
    if (this.isRateLimit) return true;
    if (this.status !== undefined && (this.status >= 500 || this.status === 404 || this.status === 408)) return true;
    return /quota|resource.?exhausted|timed? ?out|timeout|overloaded|unavailable|not.?found|no such model|does not exist|not supported|empty response|fetch failed|ECONNRESET|ETIMEDOUT|socket hang up/i.test(this.message);
  }
}

const PROVIDERS: ProviderId[] = ["zai", "openai", "google", "anthropic", "openrouter"];

function env(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value || undefined;
}

function byok(provider: ProviderId): string | undefined {
  const keys = getRequestProviderKeys();
  const v = keys[provider];
  return v && v.trim() ? v.trim() : undefined;
}

function hasCredentials(provider: ProviderId): boolean {
  if (byok(provider)) return true;
  if (provider === "zai") {
    return [join(process.cwd(), ".z-ai-config"), join(homedir(), ".z-ai-config"), "/etc/.z-ai-config"].some(existsSync) || Boolean(env("ZAI_API_KEY"));
  }
  return Boolean(env({ openai: "OPENAI_API_KEY", google: "GOOGLE_API_KEY", anthropic: "ANTHROPIC_API_KEY", openrouter: "OPENROUTER_API_KEY" }[provider]));
}

function providerModel(provider: ProviderId, requested: string): string {
  // Precedence: explicit per-provider env override > a model the caller
  // explicitly asked for on THIS provider > this provider's own default.
  // Callers must only pass `requested` when it was actually selected for
  // `provider` — never carry a model name over to a fallback provider.
  const envName = `${provider.toUpperCase()}_MODEL`;
  return env(envName) || requested || DEFAULT_MODELS[provider];
}

export function providerOrder(preferred: string): ProviderId[] {
  const requested = preferred as ProviderId;
  const fallbackNames = (env("AI_PROVIDER_FALLBACKS") || env("PROVIDER_FALLBACKS") || "")
    .split(",")
    .map((value) => value.trim().toLowerCase() as ProviderId)
    .filter((value, index, values) => PROVIDERS.includes(value) && values.indexOf(value) === index);
  const candidates = [requested, ...fallbackNames, ...PROVIDERS].filter(
    (value, index, values): value is ProviderId => PROVIDERS.includes(value as ProviderId) && values.indexOf(value) === index,
  );
  return candidates.filter(hasCredentials);
}

// Abort a model request if the provider hasn't started responding in time, so
// the agent can fall back to the next model instead of hanging.
async function fetchWithTimeout(provider: ProviderId, url: string, init: RequestInit, signal?: AbortSignal): Promise<Response> {
  const ms = Number(env("MODEL_TIMEOUT_MS") || 60000);
  const timer = new AbortController();
  const handle = setTimeout(() => timer.abort(), ms);
  const onAbort = () => timer.abort();
  signal?.addEventListener("abort", onAbort, { once: true });
  try {
    return await fetch(url, { ...init, signal: timer.signal });
  } catch (e: any) {
    if (signal?.aborted) throw e;
    if (timer.signal.aborted) throw new ProviderError(`${provider} request timed out after ${ms}ms`, provider, 408);
    throw new ProviderError(`${provider} request failed: ${e?.message || e}`, provider);
  } finally {
    clearTimeout(handle);
    signal?.removeEventListener("abort", onAbort);
  }
}

function parseSseBlock(block: string): any | null {
  const line = block.split("\n").find((value) => value.startsWith("data: "));
  if (!line) return null;
  const payload = line.slice(6).trim();
  if (!payload || payload === "[DONE]") return null;
  try { return JSON.parse(payload); } catch { return null; }
}

async function* openAiCompatibleStream(
  provider: ProviderId,
  url: string,
  apiKey: string,
  model: string,
  messages: Message[],
  temperature: number | null,
  signal?: AbortSignal,
  extraHeaders: Record<string, string> = {},
): AsyncGenerator<ProviderChunk> {
  const response = await fetchWithTimeout(provider, url, {
    method: "POST",
    headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json", ...extraHeaders },
    body: JSON.stringify({ model, messages, stream: true, ...(temperature !== null ? { temperature } : {}) }),
  }, signal);
  if (!response.ok) throw new ProviderError(`${provider} request failed (${response.status}): ${await response.text()}`, provider, response.status);
  if (!response.body) throw new ProviderError(`${provider} returned an empty response`, provider);

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const blocks = buffer.split("\n\n");
    buffer = blocks.pop() || "";
    for (const block of blocks) {
      const parsed = parseSseBlock(block);
      const delta = parsed?.choices?.[0]?.delta;
      if (delta?.reasoning_content || delta?.reasoning) yield { reasoning: delta.reasoning_content || delta.reasoning };
      if (delta?.content) yield { content: delta.content };
    }
  }
}

async function* googleStream(
  model: string,
  messages: Message[],
  temperature: number | null,
  signal?: AbortSignal,
): AsyncGenerator<ProviderChunk> {
  const key = (byok("google") || env("GOOGLE_API_KEY"))!;
  const base = env("GOOGLE_BASE_URL") || "https://generativelanguage.googleapis.com/v1beta";
  const system = messages.find((message) => message.role === "system")?.content;
  const contents = messages.filter((message) => message.role !== "system").map((message) => ({
    role: message.role === "assistant" ? "model" : "user",
    parts: [{ text: message.content }],
  }));
  const response = await fetchWithTimeout("google", `${base}/models/${encodeURIComponent(model)}:streamGenerateContent?alt=sse&key=${encodeURIComponent(key)}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
      contents,
      ...(temperature !== null ? { generationConfig: { temperature } } : {}),
    }),
  }, signal);
  if (!response.ok) throw new ProviderError(`google request failed (${response.status}): ${await response.text()}`, "google", response.status);
  if (!response.body) throw new ProviderError("google returned an empty response", "google");

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const blocks = buffer.split("\n\n");
    buffer = blocks.pop() || "";
    for (const block of blocks) {
      const parsed = parseSseBlock(block);
      const parts = parsed?.candidates?.[0]?.content?.parts || [];
      for (const part of parts) if (part.text) yield part.thought ? { reasoning: part.text } : { content: part.text };
    }
  }
}

async function* anthropicStream(
  model: string,
  messages: Message[],
  thinkingBudget: number,
  temperature: number | null,
  signal?: AbortSignal,
): AsyncGenerator<ProviderChunk> {
  const key = (byok("anthropic") || env("ANTHROPIC_API_KEY"))!;
  const base = env("ANTHROPIC_BASE_URL") || "https://api.anthropic.com/v1";
  const system = messages.find((message) => message.role === "system")?.content;
  const response = await fetch(`${base}/messages`, {
    method: "POST",
    signal,
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({
      model,
      max_tokens: Number(env("ANTHROPIC_MAX_TOKENS") || 8192),
      ...(system ? { system } : {}),
      messages: messages.filter((message) => message.role !== "system"),
      stream: true,
      ...(temperature !== null ? { temperature } : {}),
      ...(thinkingBudget > 0 ? { thinking: { type: "enabled", budget_tokens: thinkingBudget } } : {}),
    }),
  });
  if (!response.ok) throw new ProviderError(`anthropic request failed (${response.status}): ${await response.text()}`, "anthropic", response.status);
  if (!response.body) throw new ProviderError("anthropic returned an empty response", "anthropic");

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const blocks = buffer.split("\n\n");
    buffer = blocks.pop() || "";
    for (const block of blocks) {
      const parsed = parseSseBlock(block);
      const delta = parsed?.delta;
      if (delta?.type === "thinking_delta") yield { reasoning: delta.thinking };
      if (delta?.type === "text_delta") yield { content: delta.text };
    }
  }
}

export async function* createProviderStream(options: {
  provider: ProviderId;
  model: string;
  messages: Message[];
  thinkingBudget: number;
  temperature: number | null;
  signal?: AbortSignal;
}): AsyncGenerator<ProviderChunk> {
  const { provider, messages, thinkingBudget, temperature, signal } = options;
  // The caller (agent loop) passes one concrete model from providerModels();
  // fall back to the provider default only if none was given.
  const model = options.model || providerModel(provider, "");

  if (provider === "zai") {
    const zai = await ZAI.create();
    const completion = await zai.chat.completions.create({
      model,
      messages,
      stream: true,
      thinking: { type: thinkingBudget > 0 ? "enabled" : "disabled" },
      ...(temperature !== null ? { temperature } : {}),
    });
    let buffer = "";
    for await (const chunk of completion as AsyncIterable<any>) {
      if (typeof chunk === "string" || Buffer.isBuffer(chunk) || chunk instanceof Uint8Array) {
        buffer += typeof chunk === "string" ? chunk : new TextDecoder().decode(chunk);
        const blocks = buffer.split("\n\n");
        buffer = blocks.pop() || "";
        for (const block of blocks) {
          const parsed = parseSseBlock(block);
          const delta = parsed?.choices?.[0]?.delta;
          if (delta?.reasoning_content || delta?.reasoning) yield { reasoning: delta.reasoning_content || delta.reasoning };
          if (delta?.content) yield { content: delta.content };
        }
      } else {
        const delta = chunk?.choices?.[0]?.delta || chunk?.choices?.[0]?.message || {};
        if (delta.reasoning_content || delta.reasoning) yield { reasoning: delta.reasoning_content || delta.reasoning };
        if (delta.content) yield { content: delta.content };
      }
    }
    return;
  }

  if (provider === "google") {
    yield* googleStream(model, messages, temperature, signal);
    return;
  }
  if (provider === "anthropic") {
    yield* anthropicStream(model, messages, thinkingBudget, temperature, signal);
    return;
  }

  const key = (byok(provider === "openai" ? "openai" : "openrouter") || env(provider === "openai" ? "OPENAI_API_KEY" : "OPENROUTER_API_KEY"))!;
  const base = env(provider === "openai" ? "OPENAI_BASE_URL" : "OPENROUTER_BASE_URL") ||
    (provider === "openai" ? "https://api.openai.com/v1" : "https://openrouter.ai/api/v1");
  yield* openAiCompatibleStream(provider, `${base.replace(/\/$/, "")}/chat/completions`, key, model, messages, temperature, signal,
    provider === "openrouter" ? { "HTTP-Referer": env("OPENROUTER_SITE_URL") || "", "X-Title": env("OPENROUTER_APP_NAME") || "Vexor" } : {});
}
