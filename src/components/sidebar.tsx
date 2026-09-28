"use client";

import { useState, useEffect } from "react";
import { MessagesSquare, Bug, Brain, Settings, Terminal, X, Plus, Trash2, Pin, PinOff, Search, Pencil, Check, Download, FlaskConical, History, Tag, CopyCheck, Archive, ArchiveRestore, LayoutTemplate, Star, LineChart } from "lucide-react";
import type { ConversationSummary } from "@/lib/types";
import { useUIStore, useChatStore } from "@/lib/store";

interface SidebarProps {
  onNewChat: () => void;
  onOpenTemplates: () => void;
  onPick: (id: string) => void;
  onDelete: (id: string) => void;
  onTogglePin: (id: string, pinned: boolean) => void;
  onToggleFavorite: (id: string, favorited: boolean) => void;
  onToggleArchive: (id: string, archived: boolean) => void;
  onRename: (id: string, title: string) => void;
  onExport: (format?: "markdown" | "json") => void;
  onTagsChange?: () => void;
}

const TABS = [
  { id: "chats", label: "Chats", icon: MessagesSquare },
  { id: "recon", label: "Recon", icon: Bug },
  { id: "timeline", label: "Timeline", icon: LineChart },
  { id: "search", label: "Search", icon: Search },
  { id: "duplicates", label: "Dupes", icon: CopyCheck },
  { id: "history", label: "History", icon: History },
  { id: "tester", label: "Tester", icon: FlaskConical },
  { id: "agent", label: "Agent", icon: Brain },
  { id: "stats", label: "Stats", icon: Terminal },
  { id: "settings", label: "Settings", icon: Settings },
  { id: "cli", label: "Toolkit", icon: Terminal },
] as const;

export function Sidebar(props: SidebarProps) {
  const { sidebarOpen, setSidebarOpen, sidebarTab, setSidebarTab } = useUIStore();
  const conversations = useChatStore((s) => s.conversations);
  const activeId = useChatStore((s) => s.activeId);
  const findings = useChatStore((s) => s.findings);
  const exploits = useChatStore((s) => s.exploits);

  if (!sidebarOpen) return null;

  return (
    <aside className="fixed inset-y-0 left-0 z-40 w-[300px] sm:w-[340px] vx-glass-strong flex flex-col vx-fade-in lg:static lg:z-auto">
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-[var(--vx-border)]">
        <div className="flex items-center gap-1.5 text-sm font-semibold text-[var(--vx-accent)] vx-mono">
          <Terminal className="w-4 h-4" /> vexor
        </div>
        <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-[var(--vx-text-muted)] hover:text-[var(--vx-text)]">
          <X className="w-4 h-4" />
        </button>
      </div>

      <nav className="flex items-center gap-1 px-2 py-2 border-b border-[var(--vx-border)] overflow-x-auto vx-scroll">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setSidebarTab(t.id)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-colors ${
              sidebarTab === t.id
                ? "bg-[color-mix(in_oklab,var(--vx-accent)_15%,transparent)] text-[var(--vx-accent)]"
                : "text-[var(--vx-text-muted)] hover:text-[var(--vx-text)] hover:bg-[var(--vx-panel-2)]"
            }`}
          >
            <t.icon className="w-3.5 h-3.5" /> {t.label}
          </button>
        ))}
      </nav>

      <div className="flex-1 overflow-y-auto vx-scroll p-2">
        {sidebarTab === "chats" && (
          <ChatsTab conversations={conversations} activeId={activeId} onNewChat={props.onNewChat} onOpenTemplates={props.onOpenTemplates} onPick={props.onPick} onDelete={props.onDelete} onTogglePin={props.onTogglePin} onToggleFavorite={props.onToggleFavorite} onToggleArchive={props.onToggleArchive} onRename={props.onRename} onExport={props.onExport} onTagsChange={props.onTagsChange} />
        )}
        {sidebarTab === "recon" && <ReconTab findings={findings} exploits={exploits} />}
        {sidebarTab === "search" && <SearchTabStub />}
        {sidebarTab === "timeline" && <TimelineTabStub />}
        {sidebarTab === "duplicates" && <DuplicatesTabStub />}
        {sidebarTab === "history" && <HistoryTabStub />}
        {sidebarTab === "tester" && <TesterTabStub />}
        {sidebarTab === "agent" && <AgentTabStub />}
        {sidebarTab === "stats" && <StatsTabStub />}
        {sidebarTab === "settings" && <SettingsTabStub />}
        {sidebarTab === "cli" && <CliTabStub />}
      </div>
    </aside>
  );
}

// Lazy: the heavy panels are rendered in the main page; these stubs just nudge
// the user to the relevant floating panel. We keep the sidebar tabs as quick
// navigators. To avoid duplication, Recon/Agent/Settings show a compact view
// AND the main page renders the full panel below the chat on small screens.
function ChatsTab({
  conversations, activeId, onNewChat, onOpenTemplates, onPick, onDelete, onTogglePin, onToggleFavorite, onToggleArchive, onRename, onExport, onTagsChange,
}: {
  conversations: ConversationSummary[];
  activeId: string | null;
  onNewChat: () => void;
  onOpenTemplates: () => void;
  onPick: (id: string) => void;
  onDelete: (id: string) => void;
  onTogglePin: (id: string, pinned: boolean) => void;
  onToggleFavorite: (id: string, favorited: boolean) => void;
  onToggleArchive: (id: string, archived: boolean) => void;
  onRename: (id: string, title: string) => void;
  onExport: (format?: "markdown" | "json") => void;
  onTagsChange?: () => void;
}) {
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [searchResults, setSearchResults] = useState<{ id: string; title: string; pinned: boolean; updatedAt: string; snippet: string; matchCount: number }[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [allTags, setAllTags] = useState<{ name: string; color: string; count: number }[]>([]);
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [taggingConv, setTaggingConv] = useState<string | null>(null);
  const [tagDraft, setTagDraft] = useState("");
  const [tagColor, setTagColor] = useState("accent");
  const [showArchived, setShowArchived] = useState(false);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);

  // Load all distinct tags for the filter bar.
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const r = await fetch("/api/conversations/all/tags");
        const j = await r.json();
        if (!cancelled) setAllTags(j.tags || []);
      } catch {}
    };
    load();
    return () => { cancelled = true; };
  }, [conversations]);

  // Debounced full-text search across messages + titles.
  useEffect(() => {
    const q = query.trim();
    if (!q) { setSearchResults(null); setSearching(false); return; }
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
        const j = await r.json();
        setSearchResults(j.results || []);
      } catch {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [query]);

  const addTag = async (convId: string, name: string, color = tagColor) => {
    const clean = name.trim().toLowerCase().replace(/\s+/g, "-").slice(0, 24);
    if (!clean) return;
    try {
      await fetch(`/api/conversations/${convId}/tags`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: clean, color }),
      });
      setTagDraft("");
      setTaggingConv(null);
      setTagColor("accent");
      const r = await fetch("/api/conversations/all/tags");
      setAllTags((await r.json()).tags || []);
      onTagsChange?.();
    } catch {}
  };

  const TAG_COLORS = [
    { id: "accent", label: "Green" },
    { id: "cyan", label: "Cyan" },
    { id: "warn", label: "Amber" },
    { id: "danger", label: "Red" },
    { id: "ok", label: "Mint" },
  ];

  const removeTag = async (convId: string, name: string) => {
    try {
      await fetch(`/api/conversations/${convId}/tags?name=${encodeURIComponent(name)}`, { method: "DELETE" });
      const r = await fetch("/api/conversations/all/tags");
      setAllTags((await r.json()).tags || []);
      onTagsChange?.();
    } catch {}
  };

  // Build the display list: search results (with snippets) when searching,
  // tag-filtered list when a tag is active, else all convs.
  // Archived convs are hidden unless `showArchived` is on.
  // Favorites filter narrows to starred convs.
  let display: { id: string; title: string; pinned: boolean; favorited?: boolean; archived?: boolean; updatedAt: string; snippet?: string; matchCount?: number; findingCount?: number; exploitCount?: number; tags?: { id: string; name: string; color: string }[] }[];
  if (searchResults) {
    display = searchResults.map((r) => {
      const conv = conversations.find((c) => c.id === r.id);
      return { ...r, archived: conv?.archived, favorited: conv?.favorited, findingCount: conv?.findingCount, exploitCount: conv?.exploitCount, tags: conv?.tags };
    });
  } else if (activeTag) {
    display = conversations.filter((c) => c.tags?.some((t) => t.name === activeTag));
  } else {
    display = conversations;
  }
  // Apply archive filter (unless searching, where we show everything that matches).
  if (!searchResults) {
    display = display.filter((c) => !!c.archived === showArchived);
  }
  // Apply favorites filter.
  if (showFavoritesOnly) {
    display = display.filter((c) => c.favorited);
  }

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

  const tagColorClass = (color: string) => {
    const map: Record<string, string> = {
      accent: "text-[var(--vx-accent)] border-[color-mix(in_oklab,var(--vx-accent)_40%,transparent)] bg-[color-mix(in_oklab,var(--vx-accent)_10%,transparent)]",
      cyan: "text-[var(--vx-cyan)] border-[color-mix(in_oklab,var(--vx-cyan)_40%,transparent)] bg-[color-mix(in_oklab,var(--vx-cyan)_10%,transparent)]",
      warn: "text-[var(--vx-warn)] border-[color-mix(in_oklab,var(--vx-warn)_40%,transparent)] bg-[color-mix(in_oklab,var(--vx-warn)_10%,transparent)]",
      danger: "text-[var(--sev-critical)] border-[color-mix(in_oklab,var(--sev-critical)_40%,transparent)] bg-[color-mix(in_oklab,var(--sev-critical)_10%,transparent)]",
      ok: "text-[var(--vx-ok)] border-[color-mix(in_oklab,var(--vx-ok)_40%,transparent)] bg-[color-mix(in_oklab,var(--vx-ok)_10%,transparent)]",
    };
    return map[color] || map.accent;
  };

  return (
    <div className="flex flex-col gap-2">
      <button
        onClick={onNewChat}
        className="flex items-center justify-center gap-2 rounded-lg bg-[var(--vx-accent)] text-[var(--vx-bg)] px-3 py-2 text-sm font-semibold hover:opacity-90"
      >
        <Plus className="w-4 h-4" /> New conversation
      </button>
      <button
        onClick={onOpenTemplates}
        className="flex items-center justify-center gap-2 rounded-lg border border-[var(--vx-border)] px-3 py-2 text-xs text-[var(--vx-text-muted)] hover:text-[var(--vx-cyan)] hover:border-[color-mix(in_oklab,var(--vx-cyan)_40%,transparent)] transition-colors"
        title="New from template"
      >
        <LayoutTemplate className="w-3.5 h-3.5" /> Templates
      </button>
      <div className="flex items-center gap-2 rounded-lg border border-[var(--vx-border)] bg-[var(--vx-bg)] px-2.5 py-1.5 focus-within:border-[color-mix(in_oklab,var(--vx-accent)_40%,transparent)]">
        <Search className={`w-3.5 h-3.5 text-[var(--vx-text-muted)] ${searching ? "vx-spin" : ""}`} />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search messages + titles…" className="flex-1 bg-transparent outline-none text-xs vx-mono placeholder:text-[var(--vx-text-muted)]" />
        {query && <span className="text-[10px] text-[var(--vx-text-muted)] vx-mono">{searchResults?.length || 0}</span>}
      </div>
      {activeId && (
        <div className="grid grid-cols-2 gap-1.5">
          <button onClick={() => onExport("markdown")} className="flex items-center justify-center gap-1.5 rounded-lg border border-[var(--vx-border)] px-2 py-1.5 text-[11px] text-[var(--vx-text-muted)] hover:text-[var(--vx-accent)] hover:border-[color-mix(in_oklab,var(--vx-accent)_40%,transparent)] transition-colors">
            <Download className="w-3 h-3" /> .md
          </button>
          <button onClick={() => onExport("json")} className="flex items-center justify-center gap-1.5 rounded-lg border border-[var(--vx-border)] px-2 py-1.5 text-[11px] text-[var(--vx-text-muted)] hover:text-[var(--vx-cyan)] hover:border-[color-mix(in_oklab,var(--vx-cyan)_40%,transparent)] transition-colors">
            <Download className="w-3 h-3" /> .json
          </button>
        </div>
      )}
      {/* Favorites + archive filter toggles */}
      <div className="grid grid-cols-2 gap-1.5">
        <button
          onClick={() => setShowFavoritesOnly((s) => !s)}
          className={`flex items-center justify-center gap-1.5 rounded-lg border px-2 py-1.5 text-[11px] transition-colors ${
            showFavoritesOnly
              ? "border-[color-mix(in_oklab,var(--vx-warn)_50%,transparent)] bg-[color-mix(in_oklab,var(--vx-warn)_10%,transparent)] text-[var(--vx-warn)]"
              : "border-[var(--vx-border)] text-[var(--vx-text-muted)] hover:text-[var(--vx-text)] hover:bg-[var(--vx-panel-2)]"
          }`}
          title={showFavoritesOnly ? "Showing favorites only" : "Show favorites only"}
        >
          <Star className={`w-3 h-3 ${showFavoritesOnly ? "fill-current" : ""}`} />
          {showFavoritesOnly ? "Favorites" : "Favorites"}
        </button>
        <button
          onClick={() => setShowArchived((s) => !s)}
          className={`flex items-center justify-center gap-1.5 rounded-lg border px-2 py-1.5 text-[11px] transition-colors ${
            showArchived
              ? "border-[color-mix(in_oklab,var(--vx-warn)_50%,transparent)] bg-[color-mix(in_oklab,var(--vx-warn)_10%,transparent)] text-[var(--vx-warn)]"
              : "border-[var(--vx-border)] text-[var(--vx-text-muted)] hover:text-[var(--vx-text)] hover:bg-[var(--vx-panel-2)]"
          }`}
          title={showArchived ? "Showing archived conversations" : "Show archived conversations"}
        >
          {showArchived ? <ArchiveRestore className="w-3 h-3" /> : <Archive className="w-3 h-3" />}
          {showArchived ? "Active" : "Archived"}
        </button>
      </div>
      {/* Tag filter bar — shows all distinct tags; click to filter. */}
      {allTags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {allTags.map((t) => (
            <button
              key={t.name}
              onClick={() => setActiveTag((cur) => (cur === t.name ? null : t.name))}
              className={`text-[10px] vx-mono px-1.5 py-0.5 rounded border transition-all ${tagColorClass(t.color)} ${
                activeTag === t.name ? "ring-1 ring-current scale-105" : "opacity-70 hover:opacity-100"
              }`}
              title={`${t.count} conversation${t.count > 1 ? "s" : ""}`}
            >
              #{t.name} <span className="opacity-60">{t.count}</span>
            </button>
          ))}
          {activeTag && (
            <button onClick={() => setActiveTag(null)} className="text-[10px] text-[var(--vx-text-muted)] hover:text-[var(--sev-critical)] px-1 vx-mono">
              ✕ clear
            </button>
          )}
        </div>
      )}
      <div className="flex flex-col gap-1">
        {display.length === 0 && (
          <p className="text-xs text-[var(--vx-text-muted)] vx-mono text-center py-6">{query ? `No matches for "${query}".` : "No conversations yet."}</p>
        )}
        {display.map((c) => {
          const conv = conversations.find((x) => x.id === c.id);
          const findingCount = c.findingCount ?? conv?.findingCount ?? 0;
          const exploitCount = c.exploitCount ?? conv?.exploitCount ?? 0;
          return (
          <div
            key={c.id}
            className={`group rounded-lg border px-2.5 py-2 cursor-pointer transition-colors ${
              c.id === activeId
                ? "border-[color-mix(in_oklab,var(--vx-accent)_50%,transparent)] bg-[color-mix(in_oklab,var(--vx-accent)_8%,transparent)]"
                : "border-transparent hover:bg-[var(--vx-panel-2)]"
            }`}
            onClick={() => editing === c.id ? undefined : onPick(c.id)}
          >
            <div className="flex items-start gap-1.5">
              <div className="flex-1 min-w-0">
                {editing === c.id ? (
                  <input
                    autoFocus
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") { onRename(c.id, draft); setEditing(null); }
                      if (e.key === "Escape") setEditing(null);
                    }}
                    className="w-full bg-[var(--vx-bg)] border border-[var(--vx-border)] rounded px-1.5 py-0.5 text-xs vx-mono outline-none"
                  />
                ) : (
                  <div className={`text-sm font-medium truncate flex items-center gap-1 ${c.archived ? "opacity-60 italic" : ""}`}>
                    {c.archived && <Archive className="w-3 h-3 text-[var(--vx-warn)] flex-shrink-0" />}
                    {c.favorited && <Star className="w-3 h-3 text-[var(--vx-warn)] fill-current flex-shrink-0" />}
                    <span className="truncate">{query ? highlight(c.title, query) : c.title}</span>
                  </div>
                )}
                {c.snippet && c.snippet !== "(title match)" && (
                  <div className="mt-0.5 text-[10px] text-[var(--vx-text-muted)] vx-mono line-clamp-2 leading-tight">
                    {highlight(c.snippet, query)}
                  </div>
                )}
                <div className="flex items-center gap-2 mt-0.5 text-[10px] text-[var(--vx-text-muted)] vx-mono">
                  {findingCount > 0 && <span className="text-[var(--sev-high)]">{findingCount}🔍</span>}
                  {exploitCount > 0 && <span className="text-[var(--sev-critical)]">{exploitCount}🧬</span>}
                  {c.matchCount ? <span className="text-[var(--vx-accent)]">{c.matchCount} hit{c.matchCount > 1 ? "s" : ""}</span> : null}
                  <span>{new Date(c.updatedAt).toLocaleDateString()}</span>
                </div>
                {/* Tag chips for this conversation */}
                {((c.tags && c.tags.length > 0) || taggingConv === c.id) && (
                  <div className="mt-1" onClick={(e) => e.stopPropagation()}>
                    {(c.tags && c.tags.length > 0) && (
                      <div className="flex flex-wrap items-center gap-1">
                        {c.tags?.map((t) => (
                          <span key={t.id} className={`group/tag text-[9px] vx-mono px-1 py-0 rounded border ${tagColorClass(t.color)} flex items-center gap-0.5`}>
                            #{t.name}
                            <button onClick={() => removeTag(c.id, t.name)} className="opacity-0 group-hover/tag:opacity-100 hover:text-[var(--sev-critical)] leading-none">×</button>
                          </span>
                        ))}
                      </div>
                    )}
                    {taggingConv === c.id && (
                      <div className="flex items-center gap-1.5 mt-1">
                        <input
                          autoFocus
                          value={tagDraft}
                          onChange={(e) => setTagDraft(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") { addTag(c.id, tagDraft); }
                            if (e.key === "Escape") { setTaggingConv(null); setTagDraft(""); setTagColor("accent"); }
                          }}
                          placeholder="tag name…"
                          className="flex-1 min-w-[60px] bg-[var(--vx-bg)] border border-[var(--vx-border)] rounded px-1.5 py-0.5 text-[10px] vx-mono outline-none focus:border-[color-mix(in_oklab,var(--vx-accent)_50%,transparent)]"
                        />
                        <div className="flex items-center gap-0.5">
                          {TAG_COLORS.map((tc) => {
                            const colorVar = tc.id === "accent" ? "var(--vx-accent)" : tc.id === "cyan" ? "var(--vx-cyan)" : tc.id === "warn" ? "var(--vx-warn)" : tc.id === "danger" ? "var(--sev-critical)" : "var(--vx-ok)";
                            return (
                              <button
                                key={tc.id}
                                onClick={() => setTagColor(tc.id)}
                                className={`w-3 h-3 rounded-full border-2 transition-all ${tagColor === tc.id ? "ring-1 ring-offset-1 ring-offset-[var(--vx-panel)] scale-125 border-[var(--vx-panel)]" : "opacity-70 hover:opacity-100 border-transparent"}`}
                                style={{ background: colorVar }}
                                title={tc.label}
                              />
                            );
                          })}
                        </div>
                        <button
                          onClick={() => { if (tagDraft) addTag(c.id, tagDraft); else { setTaggingConv(null); setTagColor("accent"); } }}
                          className="p-0.5 rounded text-[var(--vx-ok)] hover:bg-[var(--vx-panel-2)]"
                          title="Add tag"
                        >
                          <Check className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                {editing === c.id ? (
                  <button onClick={(e) => { e.stopPropagation(); onRename(c.id, draft); setEditing(null); }} className="p-1 text-[var(--vx-ok)] hover:bg-[var(--vx-panel-2)] rounded">
                    <Check className="w-3 h-3" />
                  </button>
                ) : (
                  <>
                    <button onClick={(e) => { e.stopPropagation(); onToggleFavorite(c.id, !c.favorited); }} title={c.favorited ? "Unfavorite" : "Favorite"} className={`p-1 hover:bg-[var(--vx-panel-2)] rounded ${c.favorited ? "text-[var(--vx-warn)]" : "text-[var(--vx-text-muted)] hover:text-[var(--vx-warn)]"}`}>
                      <Star className={`w-3 h-3 ${c.favorited ? "fill-current" : ""}`} />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); onTogglePin(c.id, !c.pinned); }} title={c.pinned ? "Unpin" : "Pin"} className="p-1 text-[var(--vx-text-muted)] hover:text-[var(--vx-accent)] hover:bg-[var(--vx-panel-2)] rounded">
                      {c.pinned ? <PinOff className="w-3 h-3" /> : <Pin className="w-3 h-3" />}
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); setTaggingConv(c.id); setTagDraft(""); }} title="Add tag" className="p-1 text-[var(--vx-text-muted)] hover:text-[var(--vx-cyan)] hover:bg-[var(--vx-panel-2)] rounded">
                      <Tag className="w-3 h-3" />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); setEditing(c.id); setDraft(c.title); }} title="Rename" className="p-1 text-[var(--vx-text-muted)] hover:text-[var(--vx-accent)] hover:bg-[var(--vx-panel-2)] rounded">
                      <Pencil className="w-3 h-3" />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); onToggleArchive(c.id, !c.archived); }} title={c.archived ? "Unarchive" : "Archive"} className="p-1 text-[var(--vx-text-muted)] hover:text-[var(--vx-warn)] hover:bg-[var(--vx-panel-2)] rounded">
                      {c.archived ? <ArchiveRestore className="w-3 h-3" /> : <Archive className="w-3 h-3" />}
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); onDelete(c.id); }} title="Delete" className="p-1 text-[var(--vx-text-muted)] hover:text-[var(--sev-critical)] hover:bg-[var(--vx-panel-2)] rounded">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
          );
        })}
      </div>
    </div>
  );
}

function ReconTab({ findings, exploits }: { findings: import("@/lib/types").Finding[]; exploits: import("@/lib/types").Exploit[] }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-lg border border-[var(--vx-border)] bg-[var(--vx-panel-2)] p-2.5 text-center">
          <div className="text-2xl font-bold vx-mono text-[var(--sev-high)]">{findings.length}</div>
          <div className="text-[10px] uppercase tracking-wider text-[var(--vx-text-muted)]">Findings</div>
        </div>
        <div className="rounded-lg border border-[var(--vx-border)] bg-[var(--vx-panel-2)] p-2.5 text-center">
          <div className="text-2xl font-bold vx-mono text-[var(--sev-critical)]">{exploits.length}</div>
          <div className="text-[10px] uppercase tracking-wider text-[var(--vx-text-muted)]">Exploits</div>
        </div>
      </div>
      <p className="text-[11px] text-[var(--vx-text-muted)] vx-mono text-center py-2">
        Full findings vault & exploit catalog render below the chat on this screen, and in the dedicated panels.
      </p>
    </div>
  );
}

function AgentTabStub() {
  return <p className="text-[11px] text-[var(--vx-text-muted)] vx-mono text-center py-6">Agent controls render in the panel on the right.</p>;
}
function TesterTabStub() {
  return <p className="text-[11px] text-[var(--vx-text-muted)] vx-mono text-center py-6">The interactive Tool Tester renders in the panel on the right.</p>;
}
function HistoryTabStub() {
  return <p className="text-[11px] text-[var(--vx-text-muted)] vx-mono text-center py-6">The tool-call history timeline renders in the panel on the right.</p>;
}
function DuplicatesTabStub() {
  return <p className="text-[11px] text-[var(--vx-text-muted)] vx-mono text-center py-6">Cross-audit duplicate detection renders in the panel on the right.</p>;
}
function SearchTabStub() {
  return <p className="text-[11px] text-[var(--vx-text-muted)] vx-mono text-center py-6">Global findings search renders in the panel on the right.</p>;
}
function TimelineTabStub() {
  return <p className="text-[11px] text-[var(--vx-text-muted)] vx-mono text-center py-6">The severity-over-time chart renders in the panel on the right.</p>;
}
function StatsTabStub() {
  return <p className="text-[11px] text-[var(--vx-text-muted)] vx-mono text-center py-6">Stats dashboard renders in the panel on the right.</p>;
}
function SettingsTabStub() {
  return <p className="text-[11px] text-[var(--vx-text-muted)] vx-mono text-center py-6">Settings render in the panel on the right.</p>;
}
function CliTabStub() {
  return <p className="text-[11px] text-[var(--vx-text-muted)] vx-mono text-center py-6">Toolkit & shortcuts render in the panel on the right.</p>;
}
