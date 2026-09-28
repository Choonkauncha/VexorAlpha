"use client";

import { useEffect, useState } from "react";
import { Command as CommandPrimitive } from "cmdk";
import { Search, Plus, Trash2, Download, Settings, Wrench, Brain, Bug, Terminal, Moon, Sun, Pin, MessageSquare, History } from "lucide-react";
import type { ConversationSummary } from "@/lib/types";
import { useUIStore, useChatStore, useSettingsStore } from "@/lib/store";

interface Action {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  group: "actions" | "conversations" | "navigate";
  run: () => void;
  hint?: string;
}

export function CommandPalette({
  onNewChat,
  onDeleteActive,
  onExport,
  onPickConversation,
}: {
  onNewChat: () => void;
  onDeleteActive: () => void;
  onExport: () => void;
  onPickConversation: (id: string) => void;
}) {
  const open = useUIStore((s) => s.paletteOpen);
  const setOpen = useUIStore((s) => s.setPaletteOpen);
  const setSidebarOpen = useUIStore((s) => s.setSidebarOpen);
  const setSidebarTab = useUIStore((s) => s.setSidebarTab);
  const conversations = useChatStore((s) => s.conversations);
  const activeId = useChatStore((s) => s.activeId);
  const settings = useSettingsStore((s) => s.settings);
  const patchSettings = useSettingsStore((s) => s.patchSettings);
  const [query, setQuery] = useState("");

  // Escape closes; Cmd+K is handled by the parent (which also remounts us via
  // key so the query resets on each open).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setOpen]);

  // The parent remounts this component via key when the palette opens, so the
  // query always starts empty — no reset effect needed here.
  if (!open) return null;

  const navigate = (tab: "chats" | "recon" | "timeline" | "search" | "duplicates" | "history" | "tester" | "agent" | "stats" | "settings" | "cli") => {
    setSidebarTab(tab);
    setSidebarOpen(true);
    setOpen(false);
  };

  const toggleTheme = () => {
    if (!settings) return;
    patchSettings({ theme: settings.theme === "dark" ? "light" : "dark" });
    fetch("/api/settings", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ theme: settings.theme === "dark" ? "light" : "dark" }) });
    setOpen(false);
  };

  const actions: Action[] = [
    { id: "new", label: "New conversation", icon: Plus, group: "actions", run: () => { onNewChat(); setOpen(false); }, hint: "Ctrl+N" },
    { id: "export", label: "Export audit report (Markdown)", icon: Download, group: "actions", run: () => { onExport(); setOpen(false); } },
    { id: "delete", label: "Delete active conversation", icon: Trash2, group: "actions", run: () => { onDeleteActive(); setOpen(false); } },
    { id: "theme", label: `Switch to ${settings?.theme === "dark" ? "light" : "dark"} theme`, icon: settings?.theme === "dark" ? Sun : Moon, group: "actions", run: toggleTheme },
    { id: "nav-chats", label: "Go to Chats", icon: MessageSquare, group: "navigate", run: () => navigate("chats") },
    { id: "nav-recon", label: "Go to Recon (findings + exploits)", icon: Bug, group: "navigate", run: () => navigate("recon") },
    { id: "nav-search", label: "Go to Global Findings Search", icon: Search, group: "navigate", run: () => navigate("search") },
    { id: "nav-timeline", label: "Go to Severity Timeline chart", icon: Bug, group: "navigate", run: () => navigate("timeline") },
    { id: "nav-duplicates", label: "Go to Cross-audit Duplicates", icon: History, group: "navigate", run: () => navigate("duplicates") },
    { id: "nav-history", label: "Go to Tool-call History timeline", icon: History, group: "navigate", run: () => navigate("history") },
    { id: "nav-tester", label: "Go to Tool Tester", icon: Wrench, group: "navigate", run: () => navigate("tester") },
    { id: "nav-agent", label: "Go to Agent controls", icon: Brain, group: "navigate", run: () => navigate("agent") },
    { id: "nav-stats", label: "Go to Stats dashboard", icon: Terminal, group: "navigate", run: () => navigate("stats") },
    { id: "nav-settings", label: "Go to Settings", icon: Settings, group: "navigate", run: () => navigate("settings") },
    { id: "nav-cli", label: "Go to Toolkit & shortcuts", icon: Terminal, group: "navigate", run: () => navigate("cli") },
  ];

  const convActions: Action[] = conversations.map((c) => ({
    id: c.id,
    label: c.title,
    icon: Pin,
    group: "conversations" as const,
    run: () => { onPickConversation(c.id); setOpen(false); },
    hint: c.id === activeId ? "active" : `${c.findingCount || 0} findings`,
  }));

  const all = [...actions, ...convActions];
  const filtered = query.trim()
    ? all.filter((a) => a.label.toLowerCase().includes(query.toLowerCase()))
    : all;

  const groups: { id: Action["group"]; label: string; items: Action[] }[] = [
    { id: "actions", label: "Actions", items: filtered.filter((a) => a.group === "actions") },
    { id: "navigate", label: "Navigate", items: filtered.filter((a) => a.group === "navigate") },
    { id: "conversations", label: "Conversations", items: filtered.filter((a) => a.group === "conversations") },
  ].filter((g) => g.items.length);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[12vh] px-4" onClick={() => setOpen(false)}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-xl rounded-xl border border-[var(--vx-border)] bg-[var(--vx-panel)] shadow-2xl overflow-hidden vx-fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        <CommandPrimitive shouldFilter={false} loop>
          <div className="flex items-center gap-2 px-3 py-2.5 border-b border-[var(--vx-border)]">
            <Search className="w-4 h-4 text-[var(--vx-text-muted)]" />
            <CommandPrimitive.Input
              value={query}
              onValueChange={setQuery}
              placeholder="Search actions and conversations…"
              className="flex-1 bg-transparent outline-none text-sm vx-mono placeholder:text-[var(--vx-text-muted)]"
              autoFocus
            />
            <kbd className="text-[10px] text-[var(--vx-text-muted)] vx-mono px-1.5 py-0.5 rounded border border-[var(--vx-border)]">ESC</kbd>
          </div>
          <CommandPrimitive.List className="max-h-[50vh] overflow-y-auto vx-scroll p-1">
            {groups.map((g) => (
              <CommandPrimitive.Group key={g.id} heading={g.label} className="text-[var(--vx-text-muted)]">
                {g.items.map((a) => (
                  <CommandPrimitive.Item
                    key={a.id}
                    value={a.id}
                    onSelect={() => a.run()}
                    className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm cursor-pointer data-[selected=true]:bg-[color-mix(in_oklab,var(--vx-accent)_12%,transparent)] data-[selected=true]:text-[var(--vx-accent)]"
                  >
                    <a.icon className="w-4 h-4 text-[var(--vx-text-muted)] data-[selected=true]:text-[var(--vx-accent)]" />
                    <span className="flex-1 truncate">{a.label}</span>
                    {a.hint && <span className="text-[10px] text-[var(--vx-text-muted)] vx-mono">{a.hint}</span>}
                  </CommandPrimitive.Item>
                ))}
              </CommandPrimitive.Group>
            ))}
            {filtered.length === 0 && (
              <div className="py-8 text-center text-sm text-[var(--vx-text-muted)] vx-mono">No matches.</div>
            )}
          </CommandPrimitive.List>
        </CommandPrimitive>
      </div>
    </div>
  );
}

// Re-export types used in the panels for convenience.
export type { ConversationSummary };
