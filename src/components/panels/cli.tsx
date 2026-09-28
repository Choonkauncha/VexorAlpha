"use client";

import { useEffect, useState } from "react";
import { Terminal, Wrench, BookOpen } from "lucide-react";

interface ToolDef {
  name: string;
  description: string;
  parameters: Record<string, { type: string; description: string; required?: boolean }>;
}

export function CliPanel() {
  const [tools, setTools] = useState<ToolDef[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch("/api/tools");
        const j = await r.json();
        if (!cancelled) setTools(j.tools || []);
      } catch {}
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="flex flex-col gap-4 text-sm">
      <div className="rounded-lg border border-[color-mix(in_oklab,var(--vx-accent)_30%,transparent)] bg-[color-mix(in_oklab,var(--vx-accent)_6%,transparent)] p-3">
        <div className="flex items-center gap-2 text-[var(--vx-accent)] font-semibold mb-1">
          <Terminal className="w-4 h-4" /> Vexor agent toolkit
        </div>
        <p className="text-xs text-[var(--vx-text-muted)]">
          The agent calls these tools autonomously during an audit. You don't invoke them directly — describe what you want audited and the agent picks the right tool for each step. All tools are read-only and defensive; network tools are gated by your authorized target scope.
        </p>
      </div>

      <div>
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-[var(--vx-text-muted)] mb-2">
          <Wrench className="w-3.5 h-3.5" /> Available tools ({tools.length})
        </div>
        <div className="flex flex-col gap-1.5 max-h-[60vh] overflow-y-auto vx-scroll pr-1">
          {tools.map((t) => (
            <div key={t.name} className="rounded-lg border border-[var(--vx-border)] bg-[var(--vx-panel)] p-2.5">
              <div className="vx-mono text-sm text-[var(--vx-accent)] font-semibold">{t.name}</div>
              <div className="text-xs text-[var(--vx-text-muted)] mt-0.5">{t.description}</div>
              {Object.keys(t.parameters).length > 0 && (
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {Object.entries(t.parameters).map(([k, v]) => (
                    <span key={k} className="vx-mono text-[10px] px-1.5 py-0.5 rounded bg-[var(--vx-bg)] border border-[var(--vx-border)] text-[var(--vx-text-muted)]">
                      {v.required ? <span className="text-[var(--sev-high)]">*</span> : null}{k}: {v.type}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-lg border border-[var(--vx-border)] bg-[var(--vx-panel)] p-3">
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-[var(--vx-text-muted)] mb-1.5">
          <BookOpen className="w-3.5 h-3.5" /> Keyboard shortcuts
        </div>
        <div className="grid grid-cols-2 gap-1.5 text-xs vx-mono">
          {[
            ["⌘K / Ctrl+K", "Command palette"],
            ["⌘B / Ctrl+B", "Toggle sidebar"],
            ["⌘N / Ctrl+N", "New conversation"],
            ["/", "Focus composer"],
            ["Enter", "Send message"],
            ["Shift+Enter", "Newline"],
            ["Esc", "Close palette / panels"],
          ].map(([k, v]) => (
            <div key={k} className="flex items-center gap-2">
              <kbd className="px-1.5 py-0.5 rounded border border-[var(--vx-border)] bg-[var(--vx-bg)] text-[10px] text-[var(--vx-accent)]">{k}</kbd>
              <span className="text-[var(--vx-text-muted)]">{v}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
