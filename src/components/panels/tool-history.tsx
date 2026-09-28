"use client";

import { useEffect, useState } from "react";
import { History, Wrench, Clock, ChevronDown, ChevronRight, Copy, Check, Inbox } from "lucide-react";

interface ToolCall {
  id: string;
  name: string;
  arguments: string;
  output: string;
  durationMs: number;
  createdAt: string;
}

export function ToolHistory({ conversationId }: { conversationId: string | null }) {
  const [calls, setCalls] = useState<ToolCall[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!conversationId) { setCalls([]); return; }
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const r = await fetch(`/api/conversations/${conversationId}`);
        if (!r.ok) return;
        const j = await r.json();
        if (!cancelled) setCalls(j.toolCalls || []);
      } catch {} finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [conversationId]);

  const toggle = (id: string) =>
    setOpen((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });

  const totalMs = calls.reduce((s, c) => s + c.durationMs, 0);

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-lg border border-[color-mix(in_oklab,var(--vx-accent)_30%,transparent)] bg-[color-mix(in_oklab,var(--vx-accent)_6%,transparent)] p-3">
        <div className="flex items-center gap-2 text-[var(--vx-accent)] font-semibold mb-1">
          <History className="w-4 h-4" /> Tool Call History
        </div>
        <p className="text-xs text-[var(--vx-text-muted)]">
          Every tool the agent (or you, via the Tester) has run in this conversation, in chronological order. Click any call to inspect its arguments + output.
        </p>
      </div>

      {/* Summary stats */}
      {calls.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-lg border border-[var(--vx-border)] bg-[var(--vx-panel)] p-2.5 text-center">
            <div className="text-xl font-bold vx-mono text-[var(--vx-accent)]">{calls.length}</div>
            <div className="text-[9px] uppercase tracking-wider text-[var(--vx-text-muted)] font-semibold">Calls</div>
          </div>
          <div className="rounded-lg border border-[var(--vx-border)] bg-[var(--vx-panel)] p-2.5 text-center">
            <div className="text-xl font-bold vx-mono text-[var(--vx-cyan)]">{new Set(calls.map((c) => c.name)).size}</div>
            <div className="text-[9px] uppercase tracking-wider text-[var(--vx-text-muted)] font-semibold">Unique</div>
          </div>
          <div className="rounded-lg border border-[var(--vx-border)] bg-[var(--vx-panel)] p-2.5 text-center">
            <div className="text-xl font-bold vx-mono text-[var(--vx-warn)]">{totalMs < 1000 ? `${totalMs}` : `${(totalMs / 1000).toFixed(1)}s`}</div>
            <div className="text-[9px] uppercase tracking-wider text-[var(--vx-text-muted)] font-semibold">Total time</div>
          </div>
        </div>
      )}

      {/* Timeline */}
      {loading ? (
        <div className="text-sm text-[var(--vx-text-muted)] vx-mono p-4 text-center">Loading…</div>
      ) : calls.length === 0 ? (
        <div className="text-center py-8 px-4">
          <Inbox className="w-8 h-8 mx-auto mb-2 opacity-40 text-[var(--vx-text-muted)]" />
          <p className="text-sm text-[var(--vx-text-muted)] vx-mono">
            No tool calls yet in this conversation. Run an audit or use the Tester to populate the timeline.
          </p>
        </div>
      ) : (
        <div className="relative">
          {/* Vertical timeline line */}
          <div className="absolute left-3 top-2 bottom-2 w-px bg-[color-mix(in_oklab,var(--vx-accent)_25%,transparent)]" />
          <div className="flex flex-col gap-1.5">
            {calls.map((c, i) => {
              const isOpen = open.has(c.id);
              const args = (() => { try { return JSON.parse(c.arguments); } catch { return {}; } })();
              const argStr = JSON.stringify(args);
              return (
                <div key={c.id} className="relative pl-8 vx-fade-in">
                  {/* Timeline dot */}
                  <div className={`absolute left-2 top-3 w-3 h-3 rounded-full border-2 border-[var(--vx-panel)] ${
                    i === calls.length - 1 ? "bg-[var(--vx-accent)] vx-pulse" : "bg-[color-mix(in_oklab,var(--vx-accent)_40%,transparent)]"
                  }`} />
                  <div className="rounded-lg border border-[var(--vx-border)] bg-[var(--vx-panel)] overflow-hidden hover:border-[color-mix(in_oklab,var(--vx-accent)_30%,transparent)] transition-colors">
                    <button
                      onClick={() => toggle(c.id)}
                      className="w-full flex items-center gap-2 px-2.5 py-2 hover:bg-[color-mix(in_oklab,var(--vx-accent)_4%,transparent)] text-left"
                    >
                      {isOpen ? <ChevronDown className="w-3 h-3 text-[var(--vx-text-muted)] flex-shrink-0" /> : <ChevronRight className="w-3 h-3 text-[var(--vx-text-muted)] flex-shrink-0" />}
                      <Wrench className="w-3 h-3 text-[var(--vx-accent)] flex-shrink-0" />
                      <span className="vx-mono text-xs text-[var(--vx-accent)] font-semibold flex-shrink-0">{c.name}</span>
                      <span className="text-[var(--vx-text-muted)] vx-mono text-[0.7rem] truncate flex-1">{argStr}</span>
                      <span className="flex items-center gap-1 text-[10px] text-[var(--vx-text-muted)] vx-mono flex-shrink-0">
                        <Clock className="w-2.5 h-2.5" /> {c.durationMs}ms
                      </span>
                    </button>
                    {isOpen && (
                      <div className="px-2.5 pb-2.5 pt-1 border-t border-[var(--vx-border)] bg-[var(--vx-bg)] space-y-2">
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[10px] uppercase tracking-wider text-[var(--vx-text-muted)] font-semibold">Arguments</span>
                            <CopyButton text={c.arguments} />
                          </div>
                          <pre className="vx-mono text-[0.7rem] bg-[color-mix(in_oklab,var(--vx-panel)_60%,transparent)] border border-[var(--vx-border)] rounded p-2 overflow-x-auto"><code>{JSON.stringify(args, null, 2)}</code></pre>
                        </div>
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[10px] uppercase tracking-wider text-[var(--vx-text-muted)] font-semibold">Output ({c.output.length.toLocaleString()} chars)</span>
                            <CopyButton text={c.output} />
                          </div>
                          <pre className="vx-mono text-[0.7rem] bg-[color-mix(in_oklab,var(--vx-panel)_60%,transparent)] border border-[var(--vx-border)] rounded p-2 overflow-x-auto max-h-60 overflow-y-auto vx-scroll"><code>{c.output || "(empty)"}</code></pre>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
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
