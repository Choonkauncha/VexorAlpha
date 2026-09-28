"use client";

import { useEffect, useState } from "react";
import { X, FileText, Globe, Code2, KeyRound, Search } from "lucide-react";
import { TEMPLATES, type PromptTemplate } from "@/lib/templates";

const CATEGORY_META = {
  web: { label: "Web", icon: Globe, color: "var(--vx-accent)" },
  code: { label: "Code", icon: Code2, color: "var(--vx-cyan)" },
  crypto: { label: "Crypto", icon: KeyRound, color: "var(--vx-warn)" },
  recon: { label: "Recon", icon: Search, color: "var(--vx-ok)" },
} as const;

export function TemplatePicker({ open, onClose, onPick }: { open: boolean; onClose: () => void; onPick: (template: PromptTemplate) => void }) {
  const [filter, setFilter] = useState<string>("all");

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const filtered = filter === "all" ? TEMPLATES : TEMPLATES.filter((t) => t.category === filter);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh] px-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-2xl rounded-xl border border-[var(--vx-border)] bg-[var(--vx-panel)] shadow-2xl overflow-hidden vx-fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--vx-border)] bg-[color-mix(in_oklab,var(--vx-accent)_6%,transparent)]">
          <div className="flex items-center gap-2 text-sm font-semibold text-[var(--vx-accent)]">
            <FileText className="w-4 h-4" /> New Conversation from Template
          </div>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-[var(--vx-panel-2)] text-[var(--vx-text-muted)] hover:text-[var(--vx-text)]" aria-label="Close">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Category filter */}
        <div className="flex items-center gap-1 px-3 py-2 border-b border-[var(--vx-border)] overflow-x-auto vx-scroll">
          <button
            onClick={() => setFilter("all")}
            className={`text-[11px] vx-mono px-2.5 py-1 rounded-md transition-colors ${
              filter === "all"
                ? "bg-[color-mix(in_oklab,var(--vx-accent)_15%,transparent)] text-[var(--vx-accent)] font-semibold"
                : "text-[var(--vx-text-muted)] hover:text-[var(--vx-text)] hover:bg-[var(--vx-panel-2)]"
            }`}
          >
            All ({TEMPLATES.length})
          </button>
          {(Object.keys(CATEGORY_META) as Array<keyof typeof CATEGORY_META>).map((cat) => {
            const meta = CATEGORY_META[cat];
            const count = TEMPLATES.filter((t) => t.category === cat).length;
            const Icon = meta.icon;
            return (
              <button
                key={cat}
                onClick={() => setFilter(cat)}
                className={`flex items-center gap-1 text-[11px] vx-mono px-2.5 py-1 rounded-md transition-colors ${
                  filter === cat
                    ? "bg-[color-mix(in_oklab,var(--vx-accent)_15%,transparent)] text-[var(--vx-accent)] font-semibold"
                    : "text-[var(--vx-text-muted)] hover:text-[var(--vx-text)] hover:bg-[var(--vx-panel-2)]"
                }`}
              >
                <Icon className="w-3 h-3" style={{ color: meta.color }} />
                {meta.label} ({count})
              </button>
            );
          })}
        </div>

        {/* Templates grid */}
        <div className="p-3 max-h-[55vh] overflow-y-auto vx-scroll">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {filtered.map((t) => (
              <button
                key={t.id}
                onClick={() => { onPick(t); onClose(); }}
                className="group flex items-start gap-3 p-3 rounded-lg border border-[var(--vx-border)] bg-[var(--vx-panel-2)] hover:border-[color-mix(in_oklab,var(--vx-accent)_50%,transparent)] hover:bg-[color-mix(in_oklab,var(--vx-accent)_6%,transparent)] transition-all text-left"
              >
                <span className="text-2xl flex-shrink-0 group-hover:scale-110 transition-transform">{t.icon}</span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-[var(--vx-text)] group-hover:text-[var(--vx-accent)] transition-colors">{t.title}</div>
                  <div className="text-[11px] text-[var(--vx-text-muted)] mt-0.5">{t.description}</div>
                  {t.prompt && (
                    <div className="text-[10px] text-[var(--vx-text-muted)] vx-mono mt-1 line-clamp-2 opacity-60">
                      {t.prompt.split("\n")[0].slice(0, 80)}
                    </div>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 py-2 border-t border-[var(--vx-border)] bg-[var(--vx-panel-2)] text-center">
          <span className="text-[10px] text-[var(--vx-text-muted)] vx-mono">Pick a template to pre-fill the composer, or close for a blank chat</span>
        </div>
      </div>
    </div>
  );
}
