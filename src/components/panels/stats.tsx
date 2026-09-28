"use client";

import { useEffect, useState } from "react";
import { Activity, Flame, KeyRound, Wrench, MessagesSquare, FolderOpen, Bug, TrendingUp } from "lucide-react";

interface Stats {
  conversations: number;
  messages: number;
  findings: number;
  exploits: number;
  toolCalls: number;
  range: string;
  findingsBySeverity: Record<string, number>;
  exploitsBySeverity: Record<string, number>;
  findingsByCategory: Record<string, number>;
  toolUsage: { name: string; count: number }[];
  activity: { date: string; count: number }[];
}

const SEV_ORDER = ["critical", "high", "medium", "low", "info"];
const RANGES = [
  { id: "7d", label: "7 days" },
  { id: "30d", label: "30 days" },
  { id: "all", label: "All time" },
] as const;

export function StatsDashboard({ convId }: { convId?: string | null }) {
  const [data, setData] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [range, setRange] = useState<string>("all");

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const r = await fetch(`/api/stats?range=${range}`);
        if (!r.ok) throw new Error("failed");
        const j = await r.json();
        if (!cancelled) { setData(j); setError(null); }
      } catch (e: any) {
        if (!cancelled) setError(e.message);
      }
    };
    load();
    const id = setInterval(load, 5000);
    return () => { cancelled = true; clearInterval(id); };
  }, [convId, range]);

  if (error) return <div className="text-sm text-[var(--sev-critical)] vx-mono p-4">Stats error: {error}</div>;
  if (!data) return <div className="text-sm text-[var(--vx-text-muted)] vx-mono p-4">Loading stats…</div>;

  const cards = [
    { icon: FolderOpen, label: "Conversations", value: data.conversations, color: "var(--vx-accent)" },
    { icon: MessagesSquare, label: "Messages", value: data.messages, color: "var(--vx-cyan)" },
    { icon: KeyRound, label: "Findings", value: data.findings, color: "var(--sev-high)" },
    { icon: Flame, label: "Exploits", value: data.exploits, color: "var(--sev-critical)" },
    { icon: Wrench, label: "Tool calls", value: data.toolCalls, color: "var(--vx-warn)" },
  ];

  const maxTool = Math.max(1, ...data.toolUsage.map((t) => t.count));
  const maxActivity = Math.max(1, ...data.activity.map((a) => a.count));

  return (
    <div className="flex flex-col gap-4">
      {/* Time-range filter */}
      <div className="flex items-center gap-1 rounded-lg border border-[var(--vx-border)] bg-[var(--vx-panel)] p-1">
        {RANGES.map((r) => (
          <button
            key={r.id}
            onClick={() => setRange(r.id)}
            className={`flex-1 text-[11px] vx-mono px-2 py-1 rounded transition-colors ${
              range === r.id
                ? "bg-[color-mix(in_oklab,var(--vx-accent)_15%,transparent)] text-[var(--vx-accent)] font-semibold"
                : "text-[var(--vx-text-muted)] hover:text-[var(--vx-text)] hover:bg-[var(--vx-panel-2)]"
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-2">
        {cards.map((c) => (
          <div key={c.label} className="rounded-lg border border-[var(--vx-border)] bg-[var(--vx-panel)] p-3 relative overflow-hidden group">
            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity" style={{ background: `radial-gradient(circle at top right, color-mix(in oklab, ${c.color} 8%, transparent), transparent 70%)` }} />
            <div className="relative flex items-center gap-2 text-[11px] uppercase tracking-wider text-[var(--vx-text-muted)]">
              <c.icon className="w-3.5 h-3.5" style={{ color: c.color }} />
              {c.label}
            </div>
            <div className="relative mt-1 text-2xl font-bold vx-mono" style={{ color: c.color }}>{c.value.toLocaleString()}</div>
          </div>
        ))}
      </div>

      {/* Activity sparkline (only for time-ranged views) */}
      {data.activity && data.activity.length > 0 && (
        <div className="rounded-lg border border-[var(--vx-border)] bg-[var(--vx-panel)] p-3">
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-[var(--vx-text-muted)] mb-2">
            <TrendingUp className="w-3.5 h-3.5" /> Activity ({data.range === "7d" ? "last 7 days" : "last 30 days"})
          </div>
          <div className="flex items-end gap-0.5 h-16">
            {data.activity.map((a) => (
              <div
                key={a.date}
                className="flex-1 min-w-0 rounded-t-sm transition-all hover:opacity-80"
                style={{
                  height: `${Math.max(2, (a.count / maxActivity) * 100)}%`,
                  background: a.count > 0 ? "var(--vx-accent)" : "color-mix(in oklab, var(--vx-accent) 15%, transparent)",
                }}
                title={`${a.date}: ${a.count} record${a.count !== 1 ? "s" : ""}`}
              />
            ))}
          </div>
          <div className="flex items-center justify-between mt-1 text-[9px] text-[var(--vx-text-muted)] vx-mono">
            <span>{data.activity[0]?.date.slice(5)}</span>
            <span>{data.activity[data.activity.length - 1]?.date.slice(5)}</span>
          </div>
        </div>
      )}

      {/* Findings by severity */}
      <div className="rounded-lg border border-[var(--vx-border)] bg-[var(--vx-panel)] p-3">
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-[var(--vx-text-muted)] mb-2">
          <Bug className="w-3.5 h-3.5" /> Findings by severity
        </div>
        <div className="flex flex-col gap-1.5">
          {SEV_ORDER.map((s) => {
            const v = data.findingsBySeverity[s] || 0;
            const total = data.findings || 1;
            return (
              <div key={s} className="flex items-center gap-2">
                <span className={`vx-sev-tag vx-sev-tag-${s} w-20 justify-center`}>{s}</span>
                <div className="flex-1 h-2 rounded-full bg-[var(--vx-bg)] overflow-hidden">
                  <div className="h-full transition-all duration-500" style={{ width: `${(v / total) * 100}%`, background: `var(--sev-${s})` }} />
                </div>
                <span className="vx-mono text-xs text-[var(--vx-text-muted)] w-8 text-right">{v}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Tool usage */}
      <div className="rounded-lg border border-[var(--vx-border)] bg-[var(--vx-panel)] p-3">
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-[var(--vx-text-muted)] mb-2">
          <Activity className="w-3.5 h-3.5" /> Tool usage
        </div>
        {data.toolUsage.length === 0 ? (
          <p className="text-xs text-[var(--vx-text-muted)] vx-mono">No tool calls in this range.</p>
        ) : (
          <div className="flex flex-col gap-1">
            {data.toolUsage.slice(0, 12).map((t) => (
              <div key={t.name} className="flex items-center gap-2">
                <span className="vx-mono text-xs text-[var(--vx-accent)] w-40 truncate">{t.name}</span>
                <div className="flex-1 h-1.5 rounded-full bg-[var(--vx-bg)] overflow-hidden">
                  <div className="h-full bg-[var(--vx-accent)] transition-all duration-500" style={{ width: `${(t.count / maxTool) * 100}%` }} />
                </div>
                <span className="vx-mono text-xs text-[var(--vx-text-muted)] w-8 text-right">{t.count}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
