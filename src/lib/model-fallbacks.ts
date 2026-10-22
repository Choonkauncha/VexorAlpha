// Single place to configure which models each provider falls back across.
//
// Each list is ordered best-first and contains ONLY free-tier models, verified
// against each provider's models-list endpoint and pricing page (Oct 2026).
// On a rate limit, quota, 5xx, timeout or model-not-found error the agent
// tries the next model in the list, then moves on to the next provider.
//
// Override any list at deploy time with a comma-separated env var, e.g.
//   GOOGLE_MODELS=gemini-3.8-flash,gemini-3.5-flash-lite
// A single legacy `${PROVIDER}_MODEL` env var is still honoured and tried first.
//
// Sources:
//   Google:     https://ai.google.dev/gemini-api/docs/pricing  (Free Tier column)
//               https://ai.google.dev/gemini-api/docs/rate-limits
//   OpenRouter: https://openrouter.ai/api/v1/models  (ids ending in ":free")
//   Z.ai:       https://docs.z.ai/guides/overview/pricing  (GLM-4.7-Flash / GLM-4.5-Flash = Free)

import type { ProviderId } from "./llm";

export const FREE_MODELS: Record<ProviderId, string[]> = {
  google: [
    "gemini-flash-latest",
    "gemini-3.8-flash",
    "gemini-3.5-flash",
    "gemini-3-flash-preview",
    "gemini-flash-lite-latest",
    "gemini-3.5-flash-lite",
    "gemini-3.1-flash-lite",
    "gemma-4-31b-it",
    "gemma-4-26b-a4b-it",
  ],
  openrouter: [
    "nvidia/nemotron-3-ultra-550b-a55b:free",
    "minimax/minimax-m3.1-flash:free",
    "google/gemma-4-31b-it:free",
    "nvidia/nemotron-3-super-120b-a12b:free",
    "cohere/north-mini-code:free",
    "openrouter/free",
  ],
  zai: ["glm-4.7-flash", "glm-4.5-flash"],
  // No free tier exists for these providers; they keep their single default
  // model (only used if a paid key is configured).
  openai: [],
  anthropic: [],
};

// Legacy single-model defaults, used only when a provider has no free list.
export const DEFAULT_MODELS: Record<ProviderId, string> = {
  zai: "glm-4.6",
  openai: "gpt-4o-mini",
  google: "gemini-3.8-flash",
  anthropic: "claude-3-5-haiku-latest",
  openrouter: "openai/gpt-4o-mini",
};

function envList(name: string): string[] {
  return (process.env[name] || "").split(",").map((v) => v.trim()).filter(Boolean);
}

/**
 * Ordered, de-duplicated models to try for `provider`.
 * Precedence: model the user picked for THIS provider > `${P}_MODEL` env >
 * `${P}_MODELS` env list (or the free list above) > legacy default.
 */
export function providerModels(provider: ProviderId, requested = ""): string[] {
  const p = provider.toUpperCase();
  const list = envList(`${p}_MODELS`);
  const base = list.length ? list : FREE_MODELS[provider] || [];
  const ordered = [requested.trim(), (process.env[`${p}_MODEL`] || "").trim(), ...base];
  const out = ordered.filter((v, i, a) => v && a.indexOf(v) === i);
  return out.length ? out : [DEFAULT_MODELS[provider]];
}
