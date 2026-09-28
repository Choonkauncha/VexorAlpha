// Settings helpers — read/write the key-value Setting table, merge with defaults.

import { db } from "./db";
import { DEFAULT_RUNTIME_PARAMS, DEFAULT_SETTINGS, type AgentRuntimeParams, type AppSettings } from "./types";

export async function loadSettings(): Promise<AppSettings> {
  const rows = await db.setting.findMany();
  const kv: Record<string, string> = {};
  for (const r of rows) kv[r.key] = r.value;
  const runtime: AgentRuntimeParams = {
    maxIterations: num(kv.agent_max_iterations, DEFAULT_RUNTIME_PARAMS.maxIterations),
    minActions: num(kv.agent_min_actions, DEFAULT_RUNTIME_PARAMS.minActions),
    thinkingBudget: num(kv.agent_thinking_budget, DEFAULT_RUNTIME_PARAMS.thinkingBudget),
    temperature: kv.agent_temperature === undefined || kv.agent_temperature === "" || kv.agent_temperature === "auto" ? null : Number(kv.agent_temperature),
    reflectEvery: num(kv.agent_reflect_every, DEFAULT_RUNTIME_PARAMS.reflectEvery),
  };
  return {
    provider: kv.provider || DEFAULT_SETTINGS.provider,
    model: kv.model || DEFAULT_SETTINGS.model,
    theme: (kv.theme as "dark" | "light") || DEFAULT_SETTINGS.theme,
    targetScope: kv.target_scope || "",
    runtime,
  };
}

function num(v: string | undefined, d: number): number {
  if (v === undefined || v === "") return d;
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
}

export async function saveSettings(patch: Partial<AppSettings> & { runtime?: Partial<AgentRuntimeParams> }): Promise<AppSettings> {
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
  await db.$transaction(
    ops.map((o) =>
      db.setting.upsert({ where: { key: o.key }, create: { key: o.key, value: o.value }, update: { value: o.value } }),
    ),
  );
  return loadSettings();
}
