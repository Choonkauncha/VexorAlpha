"use client";

import { useEffect, useState } from "react";
import { Play, RotateCw, ChevronDown, ChevronRight, Wrench, AlertCircle, CheckCircle2, Clock, Bookmark, BookmarkPlus, Trash2, Zap, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ToolDef {
  name: string;
  description: string;
  parameters: Record<string, { type: string; description: string; required?: boolean }>;
}

interface RunResult {
  output: string;
  findings?: { id: string; type: string; severity: string; masked: string }[];
  exploitFiled?: boolean;
  durationMs: number;
  error?: string;
}

interface Preset {
  id: string;
  name: string;
  tool: string;
  args: Record<string, string>;
  createdAt: number;
}

const SAFE_TOOLS = [
  "jwt_inspect",
  "identify_hash",
  "transform_payload",
  "generate_attack_payloads",
  "cve_lookup",
];

const NETWORK_TOOLS = [
  "dns_lookup",
  "tls_inspect",
  "fingerprint_web_tech",
  "discover_paths",
  "analyze_js_bundles",
  "http_probe",
  "analyze_security_headers",
  "test_cors",
];

const PRESETS_KEY = "vexor:tool-presets";

function loadPresets(): Preset[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(PRESETS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function savePresets(presets: Preset[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(PRESETS_KEY, JSON.stringify(presets));
}

export function ToolTester({ conversationId, scope }: { conversationId: string | null; scope: string }) {
  const { toast } = useToast();
  const [tools, setTools] = useState<ToolDef[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [args, setArgs] = useState<Record<string, string>>({});
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<RunResult | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [presets, setPresets] = useState<Preset[]>([]);
  const [namingPreset, setNamingPreset] = useState(false);
  const [presetName, setPresetName] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch("/api/tools");
        const j = await r.json();
        if (!cancelled) {
          setTools(j.tools || []);
          if (!selected && (j.tools || []).length) setSelected(j.tools[0].name);
        }
      } catch {}
    })();
    return () => { cancelled = true; };
  }, [selected]);

  // Load presets from localStorage on mount.
  useEffect(() => { setPresets(loadPresets()); }, []);

  const current = tools.find((t) => t.name === selected);
  const visibleTools = showAll ? tools : tools.filter((t) => SAFE_TOOLS.includes(t.name) || NETWORK_TOOLS.includes(t.name));

  const savePreset = () => {
    if (!selected) return;
    if (!presetName.trim()) {
      toast({ title: "Preset name required", variant: "destructive" });
      return;
    }
    const preset: Preset = {
      id: `preset-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: presetName.trim().slice(0, 40),
      tool: selected,
      args: { ...args },
      createdAt: Date.now(),
    };
    const next = [preset, ...presets];
    setPresets(next);
    savePresets(next);
    setNamingPreset(false);
    setPresetName("");
    toast({ title: "Preset saved", description: `"${preset.name}" — ${selected}` });
  };

  const deletePreset = (id: string) => {
    const next = presets.filter((p) => p.id !== id);
    setPresets(next);
    savePresets(next);
  };

  const loadPreset = (preset: Preset) => {
    setSelected(preset.tool);
    setArgs({ ...preset.args });
    setResult(null);
    toast({ title: "Preset loaded", description: `"${preset.name}" — ${preset.tool}` });
  };

  const runPreset = async (preset: Preset) => {
    setSelected(preset.tool);
    setArgs({ ...preset.args });
    setResult(null);
    // Run immediately with the preset's args (don't wait for state to settle).
    const coerced: Record<string, unknown> = {};
    const toolDef = tools.find((t) => t.name === preset.tool);
    if (toolDef) {
      for (const [k, spec] of Object.entries(toolDef.parameters)) {
        const raw = preset.args[k];
        if (raw === undefined || raw === "") {
          if (spec.required) {
            toast({ title: "Missing required argument", description: `${k} is required for ${preset.tool}`, variant: "destructive" });
            return;
          }
          continue;
        }
        coerced[k] = spec.type === "number" ? Number(raw) : raw;
      }
    }
    setRunning(true);
    try {
      const r = await fetch("/api/tools/run", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: preset.tool, arguments: coerced, conversationId }),
      });
      const j = await r.json();
      if (!r.ok) {
        setResult({ output: "", durationMs: j.durationMs || 0, error: j.error || `HTTP ${r.status}` });
        toast({ title: `${preset.tool} failed`, description: j.error, variant: "destructive" });
      } else {
        setResult(j);
        const fcount = j.findings?.length || 0;
        toast({ title: `${preset.tool} complete`, description: `${j.durationMs}ms${fcount ? ` · ${fcount} finding(s)` : ""}` });
      }
    } catch (e: any) {
      setResult({ output: "", durationMs: 0, error: e.message });
      toast({ title: "Request failed", description: e.message, variant: "destructive" });
    } finally {
      setRunning(false);
    }
  };

  const run = async () => {
    if (!selected) return;
    // Coerce arg strings to proper types.
    const coerced: Record<string, unknown> = {};
    if (current) {
      for (const [k, spec] of Object.entries(current.parameters)) {
        const raw = args[k];
        if (raw === undefined || raw === "") {
          if (spec.required) {
            toast({ title: "Missing required argument", description: `${k} is required for ${selected}`, variant: "destructive" });
            return;
          }
          continue;
        }
        coerced[k] = spec.type === "number" ? Number(raw) : raw;
      }
    }
    setRunning(true);
    setResult(null);
    try {
      const r = await fetch("/api/tools/run", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: selected, arguments: coerced, conversationId }),
      });
      const j = await r.json();
      if (!r.ok) {
        setResult({ output: "", durationMs: j.durationMs || 0, error: j.error || `HTTP ${r.status}` });
        toast({ title: `${selected} failed`, description: j.error, variant: "destructive" });
      } else {
        setResult(j);
        const fcount = j.findings?.length || 0;
        toast({
          title: `${selected} complete`,
          description: `${j.durationMs}ms${fcount ? ` · ${fcount} finding(s) filed` : ""}${j.exploitFiled ? " · exploit filed" : ""}`,
        });
      }
    } catch (e: any) {
      setResult({ output: "", durationMs: 0, error: e.message });
      toast({ title: "Request failed", description: e.message, variant: "destructive" });
    } finally {
      setRunning(false);
    }
  };

  const isNetwork = NETWORK_TOOLS.includes(selected);

  return (
    <div className="flex flex-col gap-3 text-sm">
      <div className="rounded-lg border border-[color-mix(in_oklab,var(--vx-accent)_30%,transparent)] bg-[color-mix(in_oklab,var(--vx-accent)_6%,transparent)] p-3">
        <div className="flex items-center gap-2 text-[var(--vx-accent)] font-semibold mb-1">
          <Wrench className="w-4 h-4" /> Interactive Tool Tester
        </div>
        <p className="text-xs text-[var(--vx-text-muted)]">
          Run any of the 16 security tools directly — no LLM needed. Output is scanned for findings and filed to the active conversation. Network tools respect your authorized scope.
        </p>
      </div>

      {/* Tool selector */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[11px] uppercase tracking-wider text-[var(--vx-text-muted)] font-semibold">Tool</span>
          <button onClick={() => setShowAll((s) => !s)} className="text-[10px] text-[var(--vx-text-muted)] hover:text-[var(--vx-accent)] vx-mono">
            {showAll ? "show common only" : "show all 16"}
          </button>
        </div>
        <div className="grid grid-cols-2 gap-1 max-h-44 overflow-y-auto vx-scroll pr-1">
          {visibleTools.map((t) => {
            const isNet = NETWORK_TOOLS.includes(t.name);
            return (
              <button
                key={t.name}
                onClick={() => { setSelected(t.name); setArgs({}); setResult(null); }}
                className={`text-left px-2 py-1.5 rounded border text-xs vx-mono transition-colors ${
                  selected === t.name
                    ? "border-[color-mix(in_oklab,var(--vx-accent)_50%,transparent)] bg-[color-mix(in_oklab,var(--vx-accent)_10%,transparent)] text-[var(--vx-accent)]"
                    : "border-[var(--vx-border)] text-[var(--vx-text-muted)] hover:text-[var(--vx-text)] hover:bg-[var(--vx-panel-2)]"
                }`}
                title={t.description}
              >
                <span className="flex items-center gap-1">
                  {isNet && <span className="w-1 h-1 rounded-full bg-[var(--sev-medium)]" title="network tool" />}
                  {t.name}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Tool description */}
      {current && (
        <div className="rounded-lg border border-[var(--vx-border)] bg-[var(--vx-panel-2)] p-2.5">
          <div className="text-xs text-[var(--vx-text-muted)]">{current.description}</div>
          {isNetwork && !scope && (
            <div className="mt-2 flex items-start gap-1.5 text-[11px] text-[var(--sev-high)]">
              <AlertCircle className="w-3 h-3 mt-0.5 flex-shrink-0" />
              <span>No authorized scope set — add hosts in Settings to enable network tools.</span>
            </div>
          )}
          {isNetwork && scope && (
            <div className="mt-2 flex items-start gap-1.5 text-[11px] text-[var(--vx-ok)]">
              <CheckCircle2 className="w-3 h-3 mt-0.5 flex-shrink-0" />
              <span>Scope: <code className="vx-mono">{scope}</code></span>
            </div>
          )}
        </div>
      )}

      {/* Arguments */}
      {current && Object.keys(current.parameters).length > 0 && (
        <div className="flex flex-col gap-2">
          <span className="text-[11px] uppercase tracking-wider text-[var(--vx-text-muted)] font-semibold">Arguments</span>
          {Object.entries(current.parameters).map(([k, spec]) => (
            <div key={k}>
              <label className="flex items-center gap-1.5 text-xs mb-1">
                <span className="vx-mono text-[var(--vx-accent)]">{k}</span>
                {spec.required && <span className="text-[var(--sev-high)] text-[10px]">*</span>}
                <span className="text-[var(--vx-text-muted)] text-[10px]">: {spec.type}</span>
              </label>
              <input
                value={args[k] || ""}
                onChange={(e) => setArgs((a) => ({ ...a, [k]: e.target.value }))}
                placeholder={spec.description}
                className="w-full rounded-md border border-[var(--vx-border)] bg-[var(--vx-bg)] px-2.5 py-1.5 vx-mono text-xs outline-none focus:border-[color-mix(in_oklab,var(--vx-accent)_50%,transparent)] focus:shadow-[0_0_0_2px_color-mix(in_oklab,var(--vx-accent)_15%,transparent)] transition-all"
              />
            </div>
          ))}
        </div>
      )}

      {/* Run + Save preset buttons */}
      <div className="flex items-center gap-2">
        <button
          onClick={run}
          disabled={running || !selected}
          className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--vx-accent)] text-[var(--vx-bg)] px-4 py-2 text-sm font-semibold hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          {running ? <RotateCw className="w-4 h-4 vx-spin" /> : <Play className="w-4 h-4" />}
          {running ? "Running…" : `Run ${selected || "tool"}`}
        </button>
        {namingPreset ? (
          <div className="flex items-center gap-1 flex-1">
            <input
              autoFocus
              value={presetName}
              onChange={(e) => setPresetName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") savePreset();
                if (e.key === "Escape") { setNamingPreset(false); setPresetName(""); }
              }}
              placeholder="preset name…"
              className="flex-1 rounded-lg border border-[var(--vx-border)] bg-[var(--vx-bg)] px-2.5 py-2 vx-mono text-xs outline-none focus:border-[color-mix(in_oklab,var(--vx-accent)_50%,transparent)]"
            />
            <button onClick={savePreset} className="p-2 rounded-lg bg-[var(--vx-ok)] text-[var(--vx-bg)] hover:opacity-90" title="Save">
              <Check className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => setNamingPreset(true)}
            disabled={running || !selected}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-[var(--vx-border)] px-3 py-2 text-xs text-[var(--vx-text-muted)] hover:text-[var(--vx-cyan)] hover:border-[color-mix(in_oklab,var(--vx-cyan)_40%,transparent)] disabled:opacity-50 transition-all"
            title="Save current tool+args as a preset"
          >
            <BookmarkPlus className="w-3.5 h-3.5" /> Save
          </button>
        )}
      </div>

      {/* Saved presets */}
      {presets.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-[var(--vx-text-muted)] font-semibold">
            <Bookmark className="w-3 h-3" /> Presets ({presets.length})
          </div>
          <div className="flex flex-col gap-1 max-h-40 overflow-y-auto vx-scroll pr-1">
            {presets.map((p) => (
              <div key={p.id} className="group flex items-center gap-1.5 rounded-md border border-[var(--vx-border)] bg-[var(--vx-panel-2)] px-2 py-1.5 hover:border-[color-mix(in_oklab,var(--vx-cyan)_30%,transparent)] transition-colors">
                <button
                  onClick={() => runPreset(p)}
                  disabled={running}
                  className="flex-1 flex items-center gap-2 text-left min-w-0 disabled:opacity-50"
                  title={`Run: ${p.tool}(${JSON.stringify(p.args).slice(0, 60)})`}
                >
                  <Zap className="w-3 h-3 text-[var(--vx-cyan)] flex-shrink-0" />
                  <span className="text-xs font-medium truncate">{p.name}</span>
                  <span className="text-[10px] text-[var(--vx-text-muted)] vx-mono truncate">{p.tool}</span>
                </button>
                <button
                  onClick={() => loadPreset(p)}
                  className="p-1 text-[var(--vx-text-muted)] hover:text-[var(--vx-accent)] opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Load (edit args)"
                >
                  <ChevronRight className="w-3 h-3" />
                </button>
                <button
                  onClick={() => deletePreset(p.id)}
                  className="p-1 text-[var(--vx-text-muted)] hover:text-[var(--sev-critical)] opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Delete preset"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="rounded-lg border border-[var(--vx-border)] overflow-hidden vx-fade-in">
          <div className="flex items-center justify-between px-3 py-2 bg-[color-mix(in_oklab,var(--vx-accent)_6%,transparent)] border-b border-[var(--vx-border)]">
            <div className="flex items-center gap-2">
              {result.error ? (
                <AlertCircle className="w-3.5 h-3.5 text-[var(--sev-critical)]" />
              ) : (
                <CheckCircle2 className="w-3.5 h-3.5 text-[var(--vx-ok)]" />
              )}
              <span className="text-xs font-semibold vx-mono">{result.error ? "Error" : "Output"}</span>
            </div>
            <span className="flex items-center gap-1 text-[10px] text-[var(--vx-text-muted)] vx-mono">
              <Clock className="w-3 h-3" /> {result.durationMs}ms
            </span>
          </div>
          {result.error ? (
            <div className="p-3 text-xs text-[var(--sev-critical)] vx-mono whitespace-pre-wrap">{result.error}</div>
          ) : (
            <div className="p-3 space-y-2">
              {result.findings && result.findings.length > 0 && (
                <div className="rounded-md border border-[color-mix(in_oklab,var(--sev-high)_30%,transparent)] bg-[color-mix(in_oklab,var(--sev-high)_8%,transparent)] p-2">
                  <div className="text-[10px] uppercase tracking-wider text-[var(--sev-high)] font-semibold mb-1">
                    {result.findings.length} finding(s) filed
                  </div>
                  <ul className="space-y-0.5">
                    {result.findings.map((f) => (
                      <li key={f.id} className="text-[11px] vx-mono flex items-center gap-2">
                        <span className={`vx-sev-dot vx-sev-${f.severity}`} />
                        <span className="text-[var(--vx-text)]">{f.type}</span>
                        <code className="text-[var(--vx-cyan)] truncate">{f.masked}</code>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {result.exploitFiled && (
                <div className="rounded-md border border-[color-mix(in_oklab,var(--sev-critical)_30%,transparent)] bg-[color-mix(in_oklab,var(--sev-critical)_8%,transparent)] p-2 text-[11px] text-[var(--sev-critical)] font-medium">
                  🧬 Exploit filed to the catalog
                </div>
              )}
              <pre className="vx-mono text-xs bg-[color-mix(in_oklab,var(--vx-bg)_60%,#000_40%)] border border-[var(--vx-border)] rounded p-2.5 overflow-x-auto max-h-80 overflow-y-auto vx-scroll"><code>{result.output}</code></pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
