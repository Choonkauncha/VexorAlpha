"use client";

import { useState } from "react";
import { Save, RotateCw, ShieldAlert, Globe } from "lucide-react";
import type { AppSettings } from "@/lib/types";
import { DEFAULT_RUNTIME_PARAMS } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";

interface Props {
  settings: AppSettings;
  onSave: (patch: Partial<AppSettings>) => Promise<void>;
}

export function SettingsPanel({ settings, onSave }: Props) {
  const { toast } = useToast();
  const [provider, setProvider] = useState(settings.provider);
  const [model, setModel] = useState(settings.model);
  const [scope, setScope] = useState(settings.targetScope);
  const [theme, setTheme] = useState(settings.theme);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await onSave({ provider, model, targetScope: scope, theme });
      toast({ title: "Settings saved", description: "Provider, model, scope, and theme updated." });
    } catch (e: any) {
      toast({ title: "Save failed", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 text-sm">
      <section>
        <h3 className="text-[11px] uppercase tracking-wider text-[var(--vx-text-muted)] mb-2">Active provider</h3>
        <div className="grid grid-cols-1 gap-1.5">
          {[{ id: "zai", label: "Z.ai (GLM)" }, { id: "openai", label: "OpenAI-compatible" }, { id: "google", label: "Google AI" }, { id: "anthropic", label: "Anthropic" }, { id: "openrouter", label: "OpenRouter" }].map((p) => (
            <label key={p.id} className={`flex items-center gap-2 rounded-lg border px-3 py-2 cursor-pointer ${provider === p.id ? "border-[color-mix(in_oklab,var(--vx-accent)_50%,transparent)] bg-[color-mix(in_oklab,var(--vx-accent)_8%,transparent)]" : "border-[var(--vx-border)] hover:bg-[var(--vx-panel-2)]"}`}>
              <input type="radio" name="provider" checked={provider === p.id} onChange={() => setProvider(p.id)} className="accent-[var(--vx-accent)]" />
              <span>{p.label}</span>
            </label>
          ))}
        </div>
      </section>

      <section>
        <h3 className="text-[11px] uppercase tracking-wider text-[var(--vx-text-muted)] mb-2">Model</h3>
        <input
          value={model}
          onChange={(e) => setModel(e.target.value)}
          className="w-full rounded-lg border border-[var(--vx-border)] bg-[var(--vx-bg)] px-3 py-2 vx-mono text-sm outline-none focus:border-[color-mix(in_oklab,var(--vx-accent)_50%,transparent)]"
        />
        <p className="mt-1 text-[11px] text-[var(--vx-text-muted)]">The agent uses the Z.ai SDK by default. Override the model id here if your backend supports others.</p>
      </section>

      <section>
        <h3 className="text-[11px] uppercase tracking-wider text-[var(--vx-text-muted)] mb-2 flex items-center gap-1.5">
          <ShieldAlert className="w-3.5 h-3.5 text-[var(--sev-high)]" /> Authorized target scope
        </h3>
        {/* Allow All toggle */}
        <div className="flex items-center gap-2 mb-2">
          <button
            onClick={() => setScope(scope.trim() === "*" ? "" : "*")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[11px] font-semibold transition-all ${
              scope.trim() === "*"
                ? "border-[color-mix(in_oklab,var(--sev-critical)_50%,transparent)] bg-[color-mix(in_oklab,var(--sev-critical)_12%,transparent)] text-[var(--sev-critical)]"
                : "border-[var(--vx-border)] text-[var(--vx-text-muted)] hover:text-[var(--vx-text)] hover:bg-[var(--vx-panel-2)]"
            }`}
          >
            <Globe className="w-3.5 h-3.5" />
            {scope.trim() === "*" ? "Allow All: ON" : "Allow All: OFF"}
          </button>
          {scope.trim() === "*" && (
            <span className="text-[10px] text-[var(--sev-critical)] vx-mono">
              ⚠ Any host can be tested — use with extreme caution
            </span>
          )}
        </div>
        <textarea
          value={scope}
          onChange={(e) => setScope(e.target.value)}
          rows={3}
          disabled={scope.trim() === "*"}
          placeholder="example.com, api.example.com, 10.0.0.0/24"
          className={`w-full rounded-lg border px-3 py-2 vx-mono text-xs outline-none resize-none vx-scroll transition-all ${
            scope.trim() === "*"
              ? "border-[color-mix(in_oklab,var(--sev-critical)_30%,transparent)] bg-[color-mix(in_oklab,var(--sev-critical)_4%,transparent)] text-[var(--sev-critical)] opacity-60 cursor-not-allowed"
              : "border-[var(--vx-border)] bg-[var(--vx-bg)] focus:border-[color-mix(in_oklab,var(--vx-accent)_50%,transparent)]"
          }`}
        />
        {scope.trim() !== "*" && (
          <p className="mt-1 text-[11px] text-[var(--sev-high)]">
            ⚠ Network tools (http_probe, discover_paths, tls_inspect, fingerprint_web_tech, test_cors, analyze_js_bundles, dns_lookup) will refuse to run against any host NOT listed here. Only add systems you own or are explicitly authorized to test.
          </p>
        )}
      </section>

      <section>
        <h3 className="text-[11px] uppercase tracking-wider text-[var(--vx-text-muted)] mb-2">Theme</h3>
        <div className="grid grid-cols-2 gap-1.5">
          {(["dark", "light"] as const).map((t) => (
            <label key={t} className={`flex items-center justify-center gap-2 rounded-lg border px-3 py-2 cursor-pointer capitalize ${theme === t ? "border-[color-mix(in_oklab,var(--vx-accent)_50%,transparent)] bg-[color-mix(in_oklab,var(--vx-accent)_8%,transparent)]" : "border-[var(--vx-border)] hover:bg-[var(--vx-panel-2)]"}`}>
              <input type="radio" name="theme" checked={theme === t} onChange={() => setTheme(t)} className="accent-[var(--vx-accent)]" />
              <span>{t}</span>
            </label>
          ))}
        </div>
      </section>

      <button
        onClick={save}
        disabled={saving}
        className="mt-2 inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--vx-accent)] text-[var(--vx-bg)] px-4 py-2 text-sm font-semibold hover:opacity-90 disabled:opacity-50"
      >
        {saving ? <RotateCw className="w-4 h-4 vx-spin" /> : <Save className="w-4 h-4" />}
        Save settings
      </button>
    </div>
  );
}

interface AgentProps {
  settings: AppSettings;
  onSave: (patch: { runtime: Partial<typeof DEFAULT_RUNTIME_PARAMS> }) => Promise<void>;
}

export function AgentControlsPanel({ settings, onSave }: AgentProps) {
  const { toast } = useToast();
  const r = settings.runtime;
  const [maxIter, setMaxIter] = useState(r.maxIterations);
  const [minActions, setMinActions] = useState(r.minActions);
  const [thinking, setThinking] = useState(r.thinkingBudget);
  const [tempAuto, setTempAuto] = useState(r.temperature === null);
  const [temp, setTemp] = useState(r.temperature === null ? 0.7 : r.temperature);
  const [reflect, setReflect] = useState(r.reflectEvery);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await onSave({ runtime: { maxIterations: maxIter, minActions, thinkingBudget: thinking, temperature: tempAuto ? null : temp, reflectEvery: reflect } });
      toast({ title: "Agent controls applied", description: "Changes take effect on your next message." });
    } catch (e: any) {
      toast({ title: "Save failed", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-5 text-sm">
      <p className="text-[11px] text-[var(--vx-text-muted)]">Tune how the agent runs. Changes apply to your <b>next</b> message — no restart, no key reload.</p>

      <Slider label="Max turns" value={maxIter} min={4} max={100} step={2} onChange={setMaxIter} hint="Hard ceiling on model turns before a run stops. 40+ recommended for long-horizon autonomous audits." />
      <Slider label="Thoroughness (min tests)" value={minActions} min={0} max={30} step={1} onChange={setMinActions} hint="0 = answer as soon as ready. Higher = keep probing." />
      <Slider label="Reasoning budget (tokens)" value={thinking} min={0} max={8000} step={500} onChange={setThinking} hint="0 disables extended thinking. Higher = deeper reasoning, slower." />
      <Slider label="Reflection cadence (anti-drift)" value={reflect} min={0} max={20} step={1} onChange={setReflect} hint="Every N actions, force a self-review. 0 = off." />

      <div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={tempAuto} onChange={(e) => setTempAuto(e.target.checked)} className="accent-[var(--vx-accent)]" />
          Temperature: auto (let the model decide)
        </label>
        {!tempAuto && (
          <div className="mt-2">
            <Slider label="Temperature" value={temp} min={0} max={2} step={0.05} onChange={setTemp} hint="Lower = focused · higher = creative." />
          </div>
        )}
      </div>

      <button
        onClick={save}
        disabled={saving}
        className="mt-2 inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--vx-accent)] text-[var(--vx-bg)] px-4 py-2 text-sm font-semibold hover:opacity-90 disabled:opacity-50"
      >
        {saving ? <RotateCw className="w-4 h-4 vx-spin" /> : <Save className="w-4 h-4" />}
        Apply agent controls
      </button>
    </div>
  );
}

function Slider({ label, value, min, max, step, onChange, hint }: { label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void; hint?: string }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm">{label}</span>
        <span className="vx-mono text-xs text-[var(--vx-accent)]">{value}</span>
      </div>
      <input type="range" className="vx-range w-full" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
      {hint && <p className="mt-1 text-[11px] text-[var(--vx-text-muted)]">{hint}</p>}
    </div>
  );
}
