"use client";

import { useEffect, useState } from "react";
import { Search, Copy, Check, Inbox } from "lucide-react";

interface SearchResult {
  fingerprint: string;
  conversationId: string;
  conversationTitle: string;
  type: string;
  category: string;
  severity: string;
  value: string;
  masked: string;
  location: string;
  sourceTool: string;
  createdAt: string;
}

export function FindingsSearch({ onPickConversation }: { onPickConversation?: (id: string) => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [revealed, setRevealed] = useState<Set<string>>(new Set());

  // Debounced search across all conversations' findings.
  useEffect(() => {
    const q = query.trim();
    if (!q) { setResults(null); setSearching(false); return; }
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/findings/search?q=${encodeURIComponent(q)}`);
        const j = await r.json();
        setResults(j.results || []);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  const toggleReveal = (key: string) =>
    setRevealed((prev) => { const n = new Set(prev); if (n.has(key)) n.delete(key); else n.add(key); return n; });

  const highlight = (text: string, q: string) => {
    if (!q) return text;
    const idx = text.toLowerCase().indexOf(q.toLowerCase());
    if (idx < 0) return text;
    return (
      <>
        {text.slice(0, idx)}
        <mark className="bg-[color-mix(in_oklab,var(--vx-accent)_30%,transparent)] text-[var(--vx-accent)] rounded px-0.5">{text.slice(idx, idx + q.length)}</mark>
        {text.slice(idx + q.length)}
      </>
    );
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-lg border border-[color-mix(in_oklab,var(--vx-accent)_30%,transparent)] bg-[color-mix(in_oklab,var(--vx-accent)_6%,transparent)] p-3">
        <div className="flex items-center gap-2 text-[var(--vx-accent)] font-semibold mb-1">
          <Search className="w-4 h-4" /> Global Findings Search
        </div>
        <p className="text-xs text-[var(--vx-text-muted)]">
          Search across every conversation's findings vault — type, value, location, or conversation title.
        </p>
      </div>

      <div className="flex items-center gap-2 rounded-lg border border-[var(--vx-border)] bg-[var(--vx-bg)] px-2.5 py-1.5 focus-within:border-[color-mix(in_oklab,var(--vx-accent)_50%,transparent)]">
        <Search className={`w-3.5 h-3.5 text-[var(--vx-text-muted)] ${searching ? "vx-spin" : ""}`} />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search all findings…"
          className="flex-1 bg-transparent outline-none text-sm vx-mono placeholder:text-[var(--vx-text-muted)]"
          autoFocus
        />
        {results && <span className="text-[10px] text-[var(--vx-text-muted)] vx-mono">{results.length}</span>}
      </div>

      {results && results.length === 0 && (
        <div className="text-center py-8 px-4">
          <Inbox className="w-8 h-8 mx-auto mb-2 opacity-40 text-[var(--vx-text-muted)]" />
          <p className="text-sm text-[var(--vx-text-muted)] vx-mono">No findings match "{query}".</p>
        </div>
      )}

      {results && results.length > 0 && (
        <div className="flex flex-col gap-1.5">
          {results.map((f, i) => {
            const key = `${f.conversationId}-${f.fingerprint}-${i}`;
            const isRevealed = revealed.has(key);
            return (
              <div key={key} className="vx-finding hover:bg-[color-mix(in_oklab,var(--vx-accent)_3%,transparent)] transition-colors">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`vx-sev-dot vx-sev-${f.severity}`} />
                  <span className="text-[var(--vx-text)] font-medium text-sm">{highlight(f.type, query)}</span>
                  <span className={`vx-sev-tag vx-sev-tag-${f.severity} ml-auto !text-[9px] !px-1.5 !py-0`}>{f.severity}</span>
                </div>
                <div className="flex items-center gap-2">
                  <code className="flex-1 vx-mono text-xs text-[var(--vx-cyan)] truncate">
                    {isRevealed ? highlight(f.value, query) : f.masked}
                  </code>
                  <button onClick={() => toggleReveal(key)} className="text-[var(--vx-text-muted)] hover:text-[var(--vx-accent)] p-0.5 text-[10px]" title={isRevealed ? "Mask" : "Reveal"}>
                    {isRevealed ? "🙈" : "👁"}
                  </button>
                  <CopyButton text={f.value} />
                </div>
                <div className="mt-1 flex items-center gap-2 text-[10px] text-[var(--vx-text-muted)] vx-mono">
                  <button
                    onClick={() => onPickConversation?.(f.conversationId)}
                    className="text-[var(--vx-accent)] hover:underline truncate"
                    title="Open this conversation"
                  >
                    📋 {highlight(f.conversationTitle, query)}
                  </button>
                  {f.location && <span className="truncate">📍 {f.location}</span>}
                </div>
              </div>
            );
          })}
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
      className="text-[var(--vx-text-muted)] hover:text-[var(--vx-accent)]"
      title="Copy"
    >
      {copied ? <Check className="w-3 h-3 text-[var(--vx-ok)]" /> : <Copy className="w-3 h-3" />}
    </button>
  );
}
