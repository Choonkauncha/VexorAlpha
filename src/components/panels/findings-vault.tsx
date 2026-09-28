"use client";

import { useMemo, useState, useCallback, useEffect } from "react";
import { Search, Eye, EyeOff, Copy, Check, Filter, Trash2, CheckSquare, Square, X, Ban, CircleCheck, Download, FileDown } from "lucide-react";
import type { Finding, Severity } from "@/lib/types";
import { CATEGORIES, SEVERITY_RANK } from "@/lib/findings";
import { useToast } from "@/hooks/use-toast";

const SEVS: Severity[] = ["critical", "high", "medium", "low", "info"];

export function FindingsVault({ findings, conversationId, onChanged }: { findings: Finding[]; conversationId?: string | null; onChanged?: () => void }) {
  const { toast } = useToast();
  const [query, setQuery] = useState("");
  const [sevFilter, setSevFilter] = useState<Set<Severity>>(new Set());
  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [selectMode, setSelectMode] = useState(false);
  const [showFalsePositives, setShowFalsePositives] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return findings
      .filter((f) => showFalsePositives ? true : !f.falsePositive)
      .filter((f) => !sevFilter.size || sevFilter.has(f.severity))
      .filter((f) => !q || f.type.toLowerCase().includes(q) || f.value.toLowerCase().includes(q) || f.location.toLowerCase().includes(q) || f.category.toLowerCase().includes(q))
      .sort((a, b) => (SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]) || a.type.localeCompare(b.type));
  }, [findings, query, sevFilter, showFalsePositives]);

  const byCat = useMemo(() => {
    const m: Record<string, Finding[]> = {};
    for (const f of filtered) (m[f.category] ||= []).push(f);
    return m;
  }, [filtered]);

  const topSev = filtered.reduce<Severity | null>((min, f) => (min === null || SEVERITY_RANK[f.severity] < SEVERITY_RANK[min] ? f.severity : min), null);

  const toggleSev = (s: Severity) =>
    setSevFilter((prev) => { const n = new Set(prev); if (n.has(s)) n.delete(s); else n.add(s); return n; });

  const toggleReveal = (id: string) =>
    setRevealed((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  const toggleSelect = useCallback((id: string) =>
    setSelected((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; }), []);

  const selectAll = useCallback(() => setSelected(new Set(filtered.map((f) => f.id))), [filtered]);
  const clearSelection = useCallback(() => setSelected(new Set()), []);

  const bulkDelete = async () => {
    if (!conversationId || selected.size === 0) return;
    const fingerprints = Array.from(selected);
    try {
      const r = await fetch("/api/findings/bulk", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ conversationId, fingerprints }),
      });
      const j = await r.json();
      if (j.deleted) {
        toast({ title: "Findings deleted", description: `${j.deleted} finding${j.deleted > 1 ? "s" : ""} removed (e.g. false positives).` });
        setSelected(new Set());
        onChanged?.();
      }
    } catch (e: any) {
      toast({ title: "Bulk delete failed", description: e.message, variant: "destructive" });
    }
  };

  const toggleFalsePositive = async (fingerprint: string, current: boolean) => {
    if (!conversationId) return;
    try {
      await fetch("/api/findings/false-positive", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ conversationId, fingerprint, falsePositive: !current }),
      });
      toast({ title: !current ? "Marked as false positive" : "Restored as real finding", description: "Finding updated." });
      onChanged?.();
    } catch (e: any) {
      toast({ title: "Update failed", description: e.message, variant: "destructive" });
    }
  };

  // Count of false positives (for the toggle hint).
  const fpCount = findings.filter((f) => f.falsePositive).length;

  const exportFindings = async (format: "csv" | "json") => {
    if (!conversationId) {
      toast({ title: "No active conversation", variant: "destructive" });
      return;
    }
    try {
      const r = await fetch("/api/findings/export", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ conversationId, format, includeFalsePositives: showFalsePositives }),
      });
      if (!r.ok) throw new Error(await r.text());
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `vexor-findings-${conversationId}.${format}`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: `Findings exported (${format.toUpperCase()})`, description: `${findings.length} findings` });
    } catch (e: any) {
      toast({ title: "Export failed", description: e.message, variant: "destructive" });
    }
  };

  const [exportMenuOpen, setExportMenuOpen] = useState(false);

  if (!findings.length) {
    return (
      <div className="text-center py-10 px-4">
        <div className="text-3xl mb-2 opacity-60">🗂️</div>
        <p className="text-sm text-[var(--vx-text-muted)] vx-mono">
          No findings filed yet — exposed keys, tokens, user IDs and endpoints will be catalogued here as the audit runs.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <div className="flex-1 flex items-center gap-2 rounded-lg border border-[var(--vx-border)] bg-[var(--vx-bg)] px-2.5 py-1.5 focus-within:border-[color-mix(in_oklab,var(--vx-accent)_50%,transparent)]">
          <Search className="w-3.5 h-3.5 text-[var(--vx-text-muted)]" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search findings…"
            className="flex-1 bg-transparent outline-none text-sm vx-mono placeholder:text-[var(--vx-text-muted)]"
          />
        </div>
        <button
          onClick={() => { setSelectMode((s) => !s); setSelected(new Set()); }}
          className={`flex items-center gap-1 text-[10px] px-2 py-1.5 rounded-lg border transition-colors ${
            selectMode
              ? "border-[color-mix(in_oklab,var(--vx-accent)_50%,transparent)] bg-[color-mix(in_oklab,var(--vx-accent)_12%,transparent)] text-[var(--vx-accent)]"
              : "border-[var(--vx-border)] text-[var(--vx-text-muted)] hover:text-[var(--vx-text)] hover:bg-[var(--vx-panel-2)]"
          }`}
          title="Toggle multi-select"
        >
          {selectMode ? <CheckSquare className="w-3 h-3" /> : <Square className="w-3 h-3" />} Select
        </button>
        {/* Findings-only export dropdown */}
        <div className="relative">
          <button
            onClick={() => setExportMenuOpen((o) => !o)}
            disabled={!conversationId || findings.length === 0}
            className="flex items-center gap-1 text-[10px] px-2 py-1.5 rounded-lg border border-[var(--vx-border)] text-[var(--vx-text-muted)] hover:text-[var(--vx-cyan)] hover:border-[color-mix(in_oklab,var(--vx-cyan)_40%,transparent)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            title="Export findings only"
          >
            <FileDown className="w-3 h-3" /> Export
          </button>
          {exportMenuOpen && (
            <ExportDropdown
              onClose={() => setExportMenuOpen(false)}
              onCsv={() => { exportFindings("csv"); setExportMenuOpen(false); }}
              onJson={() => { exportFindings("json"); setExportMenuOpen(false); }}
            />
          )}
        </div>
      </div>

      {/* Bulk action bar — appears when findings are selected */}
      {selectMode && selected.size > 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-[color-mix(in_oklab,var(--vx-accent)_40%,transparent)] bg-[color-mix(in_oklab,var(--vx-accent)_8%,transparent)] px-3 py-2 vx-fade-in">
          <span className="text-xs text-[var(--vx-accent)] font-semibold vx-mono">{selected.size} selected</span>
          <div className="flex-1" />
          <button onClick={bulkDelete} className="flex items-center gap-1 text-[11px] px-2 py-1 rounded text-[var(--sev-critical)] hover:bg-[color-mix(in_oklab,var(--sev-critical)_12%,transparent)] transition-colors" title="Delete selected (false positives)">
            <Trash2 className="w-3 h-3" /> Delete
          </button>
          <button onClick={clearSelection} className="flex items-center gap-1 text-[11px] px-2 py-1 rounded text-[var(--vx-text-muted)] hover:text-[var(--vx-text)] hover:bg-[var(--vx-panel-2)] transition-colors" title="Clear selection">
            <X className="w-3 h-3" /> Clear
          </button>
        </div>
      )}

      {/* Select-all bar in select mode */}
      {selectMode && (
        <div className="flex items-center gap-2 text-[10px] text-[var(--vx-text-muted)] vx-mono">
          <button onClick={selectAll} className="text-[var(--vx-accent)] hover:underline">Select all ({filtered.length})</button>
          <button onClick={clearSelection} className="hover:underline">None</button>
        </div>
      )}

      <div className="flex items-center gap-1.5 flex-wrap">
        <Filter className="w-3 h-3 text-[var(--vx-text-muted)]" />
        {SEVS.map((s) => {
          const active = sevFilter.has(s);
          return (
            <button
              key={s}
              onClick={() => toggleSev(s)}
              className={`vx-sev-tag vx-sev-tag-${s} ${active ? "ring-1 ring-current" : "opacity-60 hover:opacity-100"}`}
            >
              <span className={`vx-sev-dot vx-sev-${s}`} /> {s}
            </button>
          );
        })}
        <span className="ml-auto text-[11px] text-[var(--vx-text-muted)] vx-mono">{filtered.length}/{findings.length}</span>
        {fpCount > 0 && (
          <button
            onClick={() => setShowFalsePositives((s) => !s)}
            className={`text-[10px] vx-mono px-1.5 py-0.5 rounded border transition-all ${
              showFalsePositives
                ? "border-[color-mix(in_oklab,var(--vx-warn)_50%,transparent)] bg-[color-mix(in_oklab,var(--vx-warn)_10%,transparent)] text-[var(--vx-warn)]"
                : "border-[var(--vx-border)] text-[var(--vx-text-muted)] hover:text-[var(--vx-text)]"
            }`}
            title={showFalsePositives ? "Hiding false positives" : `Show ${fpCount} false positive${fpCount > 1 ? "s" : ""}`}
          >
            {showFalsePositives ? " hiding FP" : ` ${fpCount} FP`}
          </button>
        )}
      </div>

      {topSev && (
        <div className={`vx-sev-tag vx-sev-tag-${topSev} self-start`}>
          <span className={`vx-sev-dot vx-sev-${topSev}`} /> highest severity: {topSev}
        </div>
      )}

      {Object.entries(CATEGORIES).map(([cat, meta]) => {
        const items = byCat[cat];
        if (!items || !items.length) return null;
        return (
          <div key={cat} className="rounded-lg border border-[var(--vx-border)] overflow-hidden">
            <div className="flex items-center gap-2 px-3 py-2 bg-[color-mix(in_oklab,var(--vx-accent)_6%,transparent)] border-b border-[var(--vx-border)]">
              <span className="text-base">{meta.icon}</span>
              <span className="text-sm font-semibold text-[var(--vx-text)]">{meta.label}</span>
              <span className="ml-auto text-xs text-[var(--vx-text-muted)] vx-mono bg-[var(--vx-bg)] px-1.5 py-0.5 rounded border border-[var(--vx-border)]">{items.length}</span>
            </div>
            <ul className="divide-y divide-[var(--vx-border)]">
              {items.map((f) => {
                const isCritical = f.severity === "critical" || f.severity === "high";
                const isSelected = selected.has(f.id);
                return (
                  <li key={f.id} className={`vx-finding !rounded-none !border-0 hover:bg-[color-mix(in_oklab,var(--vx-accent)_3%,transparent)] transition-colors ${isSelected ? "bg-[color-mix(in_oklab,var(--vx-accent)_8%,transparent)]" : ""}`}>
                    <div className="flex items-center gap-2 mb-1">
                      {selectMode ? (
                        <button onClick={() => toggleSelect(f.id)} className="flex-shrink-0" title={isSelected ? "Deselect" : "Select"}>
                          {isSelected ? <CheckSquare className="w-3.5 h-3.5 text-[var(--vx-accent)]" /> : <Square className="w-3.5 h-3.5 text-[var(--vx-text-muted)]" />}
                        </button>
                      ) : (
                        <span className={`vx-sev-dot vx-sev-${f.severity}`} />
                      )}
                      <span className={`text-[var(--vx-text)] ${isCritical ? "font-bold" : "font-medium"} ${f.falsePositive ? "line-through opacity-60" : ""}`}>{f.type}</span>
                      {f.falsePositive && (
                        <span className="text-[9px] vx-mono px-1 py-0 rounded border border-[color-mix(in_oklab,var(--vx-text-muted)_40%,transparent)] bg-[color-mix(in_oklab,var(--vx-text-muted)_10%,transparent)] text-[var(--vx-text-muted)] uppercase tracking-wider">false pos</span>
                      )}
                      <span className={`vx-sev-tag vx-sev-tag-${f.severity} ml-auto !text-[9px] !px-1.5 !py-0`}>{f.severity}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <code className={`flex-1 vx-mono text-xs text-[var(--vx-cyan)] truncate ${f.falsePositive ? "line-through opacity-50" : ""}`}>
                        {revealed.has(f.id) ? f.value : f.masked}
                      </code>
                      <button
                        onClick={() => toggleFalsePositive(f.id, !!f.falsePositive)}
                        className={`p-0.5 hover:bg-[var(--vx-panel-2)] rounded transition-colors ${f.falsePositive ? "text-[var(--vx-ok)]" : "text-[var(--vx-text-muted)] hover:text-[var(--vx-warn)]"}`}
                        title={f.falsePositive ? "Restore as real finding" : "Mark as false positive"}
                      >
                        {f.falsePositive ? <CircleCheck className="w-3.5 h-3.5" /> : <Ban className="w-3.5 h-3.5" />}
                      </button>
                      <button
                        onClick={() => toggleReveal(f.id)}
                        className="text-[var(--vx-text-muted)] hover:text-[var(--vx-accent)] p-0.5"
                        title={revealed.has(f.id) ? "Mask" : "Reveal"}
                      >
                        {revealed.has(f.id) ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                      <CopyButton text={f.value} />
                    </div>
                    {f.location && (
                      <div className="mt-1 text-[10px] text-[var(--vx-text-muted)] vx-mono truncate flex items-center gap-1">
                        <span>📍</span>
                        <a href={f.location} target="_blank" rel="noopener noreferrer" className="text-[var(--vx-cyan)] hover:underline truncate">
                          {f.location}
                        </a>
                        {f.sourceTool && <span className="text-[var(--vx-text-muted)] opacity-70">· {f.sourceTool}</span>}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {}
      }}
      className="text-[var(--vx-text-muted)] hover:text-[var(--vx-accent)]"
      title="Copy"
    >
      {copied ? <Check className="w-3.5 h-3.5 text-[var(--vx-ok)]" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}

// Export dropdown with proper Escape + outside-click handling.
// Uses a portal-free approach: a fixed backdrop that captures the click +
// stops propagation, so the dropdown's own clicks don't trigger close.
function ExportDropdown({ onClose, onCsv, onJson }: { onClose: () => void; onCsv: () => void; onJson: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <>
      <div
        className="fixed inset-0 z-30"
        onClick={(e) => { e.stopPropagation(); onClose(); }}
        onMouseDown={(e) => e.stopPropagation()}
      />
      <div className="absolute right-0 top-full mt-1 z-40 rounded-lg border border-[var(--vx-border)] bg-[var(--vx-panel)] shadow-xl py-1 min-w-[120px] vx-fade-in">
        <button
          onClick={(e) => { e.stopPropagation(); onCsv(); }}
          className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-[var(--vx-text)] hover:bg-[var(--vx-panel-2)] transition-colors"
        >
          <Download className="w-3 h-3 text-[var(--vx-accent)]" /> CSV
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onJson(); }}
          className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-[var(--vx-text)] hover:bg-[var(--vx-panel-2)] transition-colors"
        >
          <Download className="w-3 h-3 text-[var(--vx-cyan)]" /> JSON
        </button>
      </div>
    </>
  );
}
