"use client";

import { useEffect, useState } from "react";
import { Copy, Check, AlertTriangle, Repeat, ChevronDown, ChevronRight, Inbox } from "lucide-react";

interface Occurrence {
  findingId: string;
  conversationId: string;
  conversationTitle: string;
  location: string;
  sourceTool: string;
  severity: string;
  createdAt: string;
}

interface DupGroup {
  value: string;
  masked: string;
  type: string;
  category: string;
  severity: string;
  occurrenceCount: number;
  conversationCount: number;
  occurrences: Occurrence[];
}

export function DuplicatesPanel({ onPickConversation }: { onPickConversation?: (id: string) => void }) {
  const [groups, setGroups] = useState<DupGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<Set<number>>(new Set());
  const [revealed, setRevealed] = useState<Set<number>>(new Set());

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const r = await fetch("/api/findings/duplicates");
        const j = await r.json();
        if (!cancelled) setGroups(j.groups || []);
      } catch {} finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, []);

  const toggleOpen = (i: number) =>
    setOpen((prev) => { const n = new Set(prev); if (n.has(i)) n.delete(i); else n.add(i); return n; });
  const toggleReveal = (i: number) =>
    setRevealed((prev) => { const n = new Set(prev); if (n.has(i)) n.delete(i); else n.add(i); return n; });

  if (loading) return <div className="text-sm text-[var(--vx-text-muted)] vx-mono p-4">Scanning for cross-audit duplicates…</div>;

  if (groups.length === 0) {
    return (
      <div className="text-center py-8 px-4">
        <Inbox className="w-8 h-8 mx-auto mb-2 opacity-40 text-[var(--vx-text-muted)]" />
        <p className="text-sm text-[var(--vx-text-muted)] vx-mono">
          No secrets have been detected across multiple audits yet. When the same key, token, or credential appears in 2+ conversations, it will show up here as a systemic exposure.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {/* Summary banner */}
      <div className="rounded-lg border border-[color-mix(in_oklab,var(--sev-critical)_40%,transparent)] bg-[color-mix(in_oklab,var(--sev-critical)_8%,transparent)] p-3">
        <div className="flex items-center gap-2 text-[var(--sev-critical)] font-semibold mb-1">
          <Repeat className="w-4 h-4" /> Cross-Audit Duplicates
        </div>
        <p className="text-xs text-[var(--vx-text-muted)]">
          <span className="text-[var(--sev-critical)] font-bold vx-mono">{groups.length}</span> secret{groups.length > 1 ? "s" : ""} detected across multiple audits — likely un-rotated credentials or systemic exposure.
        </p>
      </div>

      {/* Duplicate groups */}
      <div className="flex flex-col gap-1.5">
        {groups.map((g, i) => {
          const isOpen = open.has(i);
          const isRevealed = revealed.has(i);
          return (
            <div key={i} className="rounded-lg border border-[var(--vx-border)] overflow-hidden">
              <div className="flex items-center gap-2 px-3 py-2 bg-[color-mix(in_oklab,var(--sev-critical)_6%,transparent)] hover:bg-[color-mix(in_oklab,var(--sev-critical)_10%,transparent)] cursor-pointer transition-colors" onClick={() => toggleOpen(i)}>
                {isOpen ? <ChevronDown className="w-3.5 h-3.5 text-[var(--vx-text-muted)]" /> : <ChevronRight className="w-3.5 h-3.5 text-[var(--vx-text-muted)]" />}
                <span className={`vx-sev-dot vx-sev-${g.severity}`} />
                <span className="text-sm font-bold text-[var(--vx-text)]">{g.type}</span>
                <span className={`vx-sev-tag vx-sev-tag-${g.severity} ml-auto`}>{g.severity}</span>
                <span className="text-[10px] text-[var(--vx-text-muted)] vx-mono bg-[var(--vx-bg)] px-1.5 py-0.5 rounded border border-[var(--vx-border)]">
                  {g.conversationCount} audits · {g.occurrenceCount}×
                </span>
              </div>
              <div className="px-3 py-2 bg-[var(--vx-panel)]">
                <div className="flex items-center gap-2 mb-1">
                  <code className="flex-1 vx-mono text-xs text-[var(--vx-cyan)] truncate">
                    {isRevealed ? g.value : g.masked}
                  </code>
                  <button onClick={() => toggleReveal(i)} className="text-[var(--vx-text-muted)] hover:text-[var(--vx-accent)] p-0.5" title={isRevealed ? "Mask" : "Reveal"}>
                    {isRevealed ? "🙈" : "👁"}
                  </button>
                  <CopyButton text={g.value} />
                </div>
                {isOpen && (
                  <div className="mt-2 pt-2 border-t border-[var(--vx-border)]">
                    <div className="text-[10px] uppercase tracking-wider text-[var(--vx-text-muted)] font-semibold mb-1.5">Found in:</div>
                    <ul className="flex flex-col gap-1">
                      {g.occurrences.map((o, j) => (
                        <li key={j} className="flex items-center gap-2 text-xs">
                          <span className={`vx-sev-dot vx-sev-${o.severity}`} />
                          <button
                            onClick={() => onPickConversation?.(o.conversationId)}
                            className="text-[var(--vx-accent)] hover:underline truncate flex-1 text-left vx-mono"
                            title="Open this conversation"
                          >
                            {o.conversationTitle}
                          </button>
                          {o.location && <span className="text-[10px] text-[var(--vx-text-muted)] vx-mono truncate max-w-[120px]">{o.location}</span>}
                          <span className="text-[10px] text-[var(--vx-text-muted)] vx-mono">{new Date(o.createdAt).toLocaleDateString()}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
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
      className="text-[10px] flex items-center gap-1 text-[var(--vx-text-muted)] hover:text-[var(--vx-accent)]"
    >
      {copied ? <Check className="w-3 h-3 text-[var(--vx-ok)]" /> : <Copy className="w-3 h-3" />}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}
