"use client";

import { useEffect, useState } from "react";
import { TrendingUp, Critical, AlertTriangle, Info } from "lucide-react";

interface DayBucket {
  date: string;
  critical: number;
  high: number;
  medium: number;
  low: number;
  info: number;
  total: number;
}

interface TimelineData {
  range: string;
  days: number;
  timeline: DayBucket[];
  totals: Record<string, number>;
}

const RANGES = [
  { id: "7d", label: "7d" },
  { id: "30d", label: "30d" },
  { id: "90d", label: "90d" },
  { id: "all", label: "All" },
] as const;

const SEVS = [
  { id: "critical", color: "var(--sev-critical)", label: "Critical" },
  { id: "high", color: "var(--sev-high)", label: "High" },
  { id: "medium", color: "var(--sev-medium)", label: "Medium" },
  { id: "low", color: "var(--sev-low)", label: "Low" },
  { id: "info", color: "var(--sev-info)", label: "Info" },
] as const;

export function SeverityTimeline() {
  const [data, setData] = useState<TimelineData | null>(null);
  const [range, setRange] = useState<string>("30d");
  const [hovered, setHovered] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const r = await fetch(`/api/findings/timeline?range=${range}`);
        const j = await r.json();
        if (!cancelled) setData(j);
      } catch {}
    };
    load();
    return () => { cancelled = true; };
  }, [range]);

  if (!data) return <div className="text-sm text-[var(--vx-text-muted)] vx-mono p-4">Loading timeline…</div>;

  const maxTotal = Math.max(1, ...data.timeline.map((d) => d.total));

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-lg border border-[color-mix(in_oklab,var(--vx-accent)_30%,transparent)] bg-[color-mix(in_oklab,var(--vx-accent)_6%,transparent)] p-3">
        <div className="flex items-center gap-2 text-[var(--vx-accent)] font-semibold mb-1">
          <TrendingUp className="w-4 h-4" /> Severity Over Time
        </div>
        <p className="text-xs text-[var(--vx-text-muted)]">
          Daily finding counts by severity. Hover any bar for details.
        </p>
      </div>

      {/* Range filter */}
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

      {/* Totals row */}
      <div className="grid grid-cols-5 gap-1.5">
        {SEVS.map((s) => {
          const count = data.totals[s.id] || 0;
          return (
            <div key={s.id} className="rounded-md border border-[var(--vx-border)] bg-[var(--vx-panel)] p-1.5 text-center">
              <div className="text-lg font-bold vx-mono" style={{ color: s.color }}>{count}</div>
              <div className="text-[8px] uppercase tracking-wider text-[var(--vx-text-muted)] font-semibold">{s.label}</div>
            </div>
          );
        })}
      </div>

      {/* Stacked bar chart */}
      {data.timeline.length === 0 || data.totals.total === 0 ? (
        <div className="text-center py-8">
          <Info className="w-8 h-8 mx-auto mb-2 opacity-40 text-[var(--vx-text-muted)]" />
          <p className="text-sm text-[var(--vx-text-muted)] vx-mono">No findings in this range.</p>
        </div>
      ) : (
        <div className="rounded-lg border border-[var(--vx-border)] bg-[var(--vx-panel)] p-3">
          <div className="flex items-end gap-px h-32 relative">
            {data.timeline.map((day, i) => {
              const heightPct = (day.total / maxTotal) * 100;
              const isHovered = hovered === i;
              return (
                <div
                  key={day.date}
                  className="flex-1 min-w-0 relative group cursor-pointer"
                  style={{ height: "100%" }}
                  onMouseEnter={() => setHovered(i)}
                  onMouseLeave={() => setHovered(null)}
                >
                  <div className="absolute bottom-0 left-0 right-0 flex flex-col-reverse transition-all" style={{ height: `${heightPct}%` }}>
                    {SEVS.map((s) => {
                      const sevCount = day[s.id as keyof DayBucket] as number;
                      if (sevCount === 0) return null;
                      const sevPct = day.total > 0 ? (sevCount / day.total) * 100 : 0;
                      return (
                        <div
                          key={s.id}
                          className="transition-all"
                          style={{
                            height: `${sevPct}%`,
                            background: s.color,
                            opacity: isHovered ? 1 : 0.85,
                          }}
                        />
                      );
                    })}
                  </div>
                  {/* Hover tooltip */}
                  {isHovered && day.total > 0 && (
                    <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 z-10 rounded-lg border border-[var(--vx-border)] bg-[var(--vx-bg)] shadow-xl p-2 min-w-[140px] pointer-events-none vx-fade-in">
                      <div className="text-[10px] vx-mono text-[var(--vx-text-muted)] mb-1">{day.date}</div>
                      <div className="flex items-center gap-2 text-xs font-bold mb-1">
                        <span className="text-[var(--vx-text)]">{day.total}</span>
                        <span className="text-[var(--vx-text-muted)] font-normal">findings</span>
                      </div>
                      <div className="flex flex-col gap-0.5">
                        {SEVS.filter((s) => (day[s.id as keyof DayBucket] as number) > 0).map((s) => (
                          <div key={s.id} className="flex items-center gap-1.5 text-[10px] vx-mono">
                            <span className="w-2 h-2 rounded-full" style={{ background: s.color }} />
                            <span className="text-[var(--vx-text-muted)]">{s.label}</span>
                            <span className="ml-auto text-[var(--vx-text)]">{day[s.id as keyof DayBucket] as number}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          {/* X-axis labels */}
          <div className="flex items-center justify-between mt-2 text-[9px] text-[var(--vx-text-muted)] vx-mono">
            <span>{data.timeline[0]?.date.slice(5)}</span>
            <span>{data.timeline[Math.floor(data.timeline.length / 2)]?.date.slice(5)}</span>
            <span>{data.timeline[data.timeline.length - 1]?.date.slice(5)}</span>
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-2">
        {SEVS.map((s) => (
          <div key={s.id} className="flex items-center gap-1 text-[10px] vx-mono text-[var(--vx-text-muted)]">
            <span className="w-2.5 h-2.5 rounded-sm" style={{ background: s.color }} />
            {s.label}
          </div>
        ))}
      </div>
    </div>
  );
}
