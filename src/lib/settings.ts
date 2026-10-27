// Settings helpers — per-user key-value Setting table, merge with defaults.
// Provider BYOK keys are stored per-tenant and never returned in cleartext.

import { db } from "./db";
import { DEFAULT_RUNTIME_PARAMS, DEFAULT_SETTINGS, type AgentRuntimeParams, type AppSettings, type ProviderKeys } from "./types";

const KEY_FIELDS: (keyof ProviderKeys)[] = ["openai", "google", "anthropic", "openrouter", "zai"];

function maskKey(value: string): string {
  if (!value) return "";
  if (value.length <= 8) return "••••••••";
  return `${value.slice(0, 3)}••••${value.slice(-4)}`;
}

export async function loadSettings(userId: string): Promise<AppSettings> {
  const rows = await db.setting.findMany({ where: { userId } });
  const kv: Record<string, string> = {};
  for (const r of rows) kv[r.key] = r.value;
  const runtime: AgentRuntimeParams = {
    maxIterations: num(kv.agent_max_iterations, DEFAULT_RUNTIME_PARAMS.maxIterations),
    minActions: num(kv.agent_min_actions, DEFAULT_RUNTIME_PARAMS.minActions),
    thinkingBudget: num(kv.agent_thinking_budget, DEFAULT_RUNTIME_PARAMS.thinkingBudget),
    temperature: kv.agent_temperature === undefined || kv.agent_temperature === "" || kv.agent_temperature === "auto" ? null : Number(kv.agent_temperature),
    reflectEvery: num(kv.agent_reflect_every, DEFAULT_RUNTIME_PARAMS.reflectEvery),
  };
  const providerKeys: ProviderKeys = {};
  const providerKeysPresent: Partial<Record<keyof ProviderKeys, boolean>> = {};
  for (const k of KEY_FIELDS) {
    const raw = kv[`provider_key_${k}`] || "";
    if (raw) {
      providerKeys[k] = maskKey(raw);
      providerKeysPresent[k] = true;
    }
  }
  return {
    provider: kv.provider || DEFAULT_SETTINGS.provider,
    model: kv.model || DEFAULT_SETTINGS.model,
    theme: (kv.theme as "dark" | "light") || DEFAULT_SETTINGS.theme,
    targetScope: kv.target_scope || "",
    runtime,
    providerKeys,
    providerKeysPresent,
  };
}

/** Raw (unmasked) BYOK keys for server-side LLM calls only — never send to clients. */
export async function loadProviderKeys(userId: string): Promise<ProviderKeys> {
  const rows = await db.setting.findMany({
    where: { userId, key: { in: KEY_FIELDS.map((k) => `provider_key_${k}`) } },
  });
  const out: ProviderKeys = {};
  for (const r of rows) {
    const name = r.key.replace(/^provider_key_/, "") as keyof ProviderKeys;
    if (KEY_FIELDS.includes(name) && r.value) out[name] = r.value;
  }
  return out;
}

function num(v: string | undefined, d: number): number {
  if (v === undefined || v === "") return d;
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
}

export async function saveSettings(
  userId: string,
  patch: Omit<Partial<AppSettings>, "runtime" | "providerKeys" | "providerKeysPresent"> & {
    runtime?: Partial<AgentRuntimeParams>;
    providerKeys?: Partial<ProviderKeys>;
  },
): Promise<AppSettings> {
  const ops: { key: string; value: string }[] = [];
  if (patch.provider !== undefined) ops.push({ key: "provider", value: patch.provider });
  if (patch.model !== undefined) ops.push({ key: "model", value: patch.model });
  if (patch.theme !== undefined) ops.push({ key: "theme", value: patch.theme });
  if (patch.targetScope !== undefined) ops.push({ key: "target_scope", value: patch.targetScope });
  if (patch.runtime) {
    const r = patch.runtime;
    if (r.maxIterations !== undefined) ops.push({ key: "agent_max_iterations", value: String(r.maxIterations) });
    if (r.minActions !== undefined) ops.push({ key: "agent_min_actions", value: String(r.minActions) });
    if (r.thinkingBudget !== undefined) ops.push({ key: "agent_thinking_budget", value: String(r.thinkingBudget) });
    if (r.temperature !== undefined) ops.push({ key: "agent_temperature", value: r.temperature === null ? "auto" : String(r.temperature) });
    if (r.reflectEvery !== undefined) ops.push({ key: "agent_reflect_every", value: String(r.reflectEvery) });
  }
  if (patch.providerKeys) {
    for (const k of KEY_FIELDS) {
      const v = patch.providerKeys[k];
      if (v === undefined) continue;
      // Empty string clears the key; masked placeholders are ignored.
      if (v === "") {
        ops.push({ key: `provider_key_${k}`, value: "" });
      } else if (!v.includes("••••")) {
        ops.push({ key: `provider_key_${k}`, value: v.trim() });
      }
    }
  }
  if (ops.length) {
    await db.$transaction(
      ops.map((o) =>
        db.setting.upsert({
          where: { userId_key: { userId, key: o.key } },
          create: { userId, key: o.key, value: o.value },
          update: { value: o.value },
        }),
      ),
    );
  }
  return loadSettings(userId);
}
