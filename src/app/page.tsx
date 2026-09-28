"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Menu, Moon, Sun, Command as CommandIcon, Shield, Activity, PanelRightOpen, PanelRightClose, Bug, Brain, Settings as SettingsIcon, Terminal, FlaskConical, Trash2, RotateCw, History, CopyCheck, Search, LineChart } from "lucide-react";
import { toast } from "sonner";

import { Sidebar } from "@/components/sidebar";
import { CommandPalette } from "@/components/command-palette";
import { ShortcutsOverlay } from "@/components/shortcuts-overlay";
import { TemplatePicker } from "@/components/template-picker";
import type { PromptTemplate } from "@/lib/templates";
import { Landing } from "@/components/chat/landing";
import { MessageBubble, ThinkingBubble } from "@/components/chat/message";
import { Composer } from "@/components/chat/composer";
import { FindingsVault } from "@/components/panels/findings-vault";
import { ExploitCatalog } from "@/components/panels/exploit-catalog";
import { SettingsPanel, AgentControlsPanel } from "@/components/panels/settings";
import { StatsDashboard } from "@/components/panels/stats";
import { CliPanel } from "@/components/panels/cli";
import { ToolTester } from "@/components/panels/tool-tester";
import { ToolHistory } from "@/components/panels/tool-history";
import { DuplicatesPanel } from "@/components/panels/duplicates";
import { FindingsSearch } from "@/components/panels/findings-search";
import { SeverityTimeline } from "@/components/panels/severity-timeline";

import { useChatStore, useSettingsStore, useUIStore } from "@/lib/store";
import type { AgentEvent, AppSettings, ChatMessage } from "@/lib/types";
import { DEFAULT_SETTINGS } from "@/lib/types";

export default function Home() {
  return <AppShell />;
}

// Strip <tool_call> blocks from streamed text — handles BOTH complete blocks
// (with closing </tool_call>) AND partial blocks (opening tag but no close yet,
// which happens mid-stream). This prevents raw JSON from flashing in the UI.
function stripToolCallsFromText(text: string): string {
  // Remove complete blocks first.
  let s = text.replace(/<tool_call>[\s\S]*?<\/tool_call>/g, "");
  // Remove any trailing partial block (opening tag without close).
  s = s.replace(/<tool_call>[\s\S]*$/, "");
  return s.trim();
}

function AppShell() {
  const { settings, setSettings, patchSettings } = useSettingsStore();
  const {
    conversations, setConversations, activeId, setActive,
    messages, setMessages, appendMessage,
    findings, setFindings, addFindings,
    exploits, setExploits, upsertExploit,
    streaming, setStreaming, thinking, setThinking, progress, setProgress, reset,
  } = useChatStore();
  const { sidebarOpen, setSidebarOpen, sidebarTab, setSidebarTab, paletteOpen, setPaletteOpen } = useUIStore();

  const [composerValue, setComposerValue] = useState("");
  const [paletteKey, setPaletteKey] = useState(0);
  const [showPanel, setShowPanel] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [thinkingFrame, setThinkingFrame] = useState(0);
  const [thinkingSnippet, setThinkingSnippet] = useState("");
  const thinkingReasoningRef = useRef("");
  const thinkingStartRef = useRef<number | null>(null);

  const refreshConversations = useCallback(async () => {
    try {
      // Always fetch with includeArchived=1 so the sidebar can toggle visibility
      // without an extra round-trip. The sidebar filters client-side.
      const r = await fetch("/api/conversations?includeArchived=1");
      const list = await r.json();
      setConversations(list);
    } catch {}
  }, [setConversations]);

  // ---------- boot: load settings + conversations ----------
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/settings");
        const s: AppSettings = await r.json();
        setSettings({ ...DEFAULT_SETTINGS, ...s });
      } catch {
        setSettings(DEFAULT_SETTINGS);
      }
    })();
    refreshConversations();
  }, [refreshConversations]);

  // ---------- actions ----------
  const newChat = useCallback(async () => {
    if (streaming) return;
    reset();
    setMessages([]);
    refreshConversations();
  }, [streaming, reset, setMessages, refreshConversations]);

  // Start a new chat from a template — resets the view + pre-fills the composer.
  const newChatFromTemplate = useCallback(async (template: PromptTemplate) => {
    if (streaming) return;
    reset();
    setMessages([]);
    refreshConversations();
    setComposerValue(template.prompt);
    setTimeout(() => {
      const ta = document.querySelector("textarea");
      ta?.focus();
      // Place cursor at the end so the user can immediately type the target.
      if (template.prompt) {
        ta?.setSelectionRange(template.prompt.length, template.prompt.length);
      }
    }, 0);
    if (template.id !== "blank") {
      toast.success(`Template: ${template.title}`, { description: "Composer pre-filled — edit and send." });
    }
  }, [streaming, reset, setMessages, refreshConversations, setComposerValue]);

  // ---------- keyboard shortcuts ----------
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [templatePickerOpen, setTemplatePickerOpen] = useState(false);
  const openPalette = useCallback(() => {
    setPaletteKey((k) => k + 1);
    setPaletteOpen(true);
  }, [setPaletteOpen]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "b") { e.preventDefault(); setSidebarOpen(!sidebarOpen); }
      if ((e.metaKey || e.ctrlKey) && e.key === "n") { e.preventDefault(); newChat(); }
      if ((e.metaKey || e.ctrlKey) && e.key === "k") { e.preventDefault(); openPalette(); }
      // "?" opens the shortcuts overlay — but not while typing in an input.
      if (e.key === "?" && document.activeElement?.tagName !== "TEXTAREA" && document.activeElement?.tagName !== "INPUT") {
        e.preventDefault();
        setShortcutsOpen((s) => !s);
      }
      if (e.key === "/" && document.activeElement?.tagName !== "TEXTAREA" && document.activeElement?.tagName !== "INPUT") {
        e.preventDefault();
        const ta = document.querySelector("textarea");
        ta?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sidebarOpen, setSidebarOpen, openPalette, newChat]);

  // ---------- thinking animation ----------
  useEffect(() => {
    if (!thinking) {
      thinkingReasoningRef.current = "";
      thinkingStartRef.current = null;
      return;
    }
    if (thinkingStartRef.current === null) thinkingStartRef.current = Date.now();
    const id = setInterval(() => setThinkingFrame((f) => f + 1), 120);
    return () => clearInterval(id);
  }, [thinking]);

  // ---------- auto-scroll ----------
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages, thinking]);

  const pickConversation = useCallback(async (id: string) => {
    if (streaming) return;
    try {
      const r = await fetch(`/api/conversations/${id}`);
      if (!r.ok) return;
      const data = await r.json();
      setActive(id);
      setMessages(data.messages || []);
      setFindings(data.findings || []);
      setExploits(data.exploits || []);
      // Reset the duplicate counter so loading an existing conversation doesn't
      // trigger a false "new duplicate" toast. Set to -1 so the first
      // refreshRecon after this sets the baseline without toasting.
      lastDupeCountRef.current = -1;
    } catch (e: any) {
      toast.error("Failed to load conversation: " + e.message);
    }
  }, [streaming, setActive, setMessages, setFindings, setExploits]);

  const deleteConversation = useCallback(async (id: string) => {
    try {
      await fetch(`/api/conversations/${id}`, { method: "DELETE" });
      if (id === activeId) { reset(); setMessages([]); }
      refreshConversations();
      toast.success("Conversation deleted");
    } catch (e: any) {
      toast.error("Delete failed: " + e.message);
    }
  }, [activeId, refreshConversations, reset, setMessages]);

  const togglePin = useCallback(async (id: string, pinned: boolean) => {
    await fetch(`/api/conversations/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ pinned }) });
    refreshConversations();
  }, [refreshConversations]);

  const toggleFavorite = useCallback(async (id: string, favorited: boolean) => {
    await fetch(`/api/conversations/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ favorited }) });
    refreshConversations();
    toast.success(favorited ? "★ Favorited" : "Unfavorited");
  }, [refreshConversations]);

  const toggleArchive = useCallback(async (id: string, archived: boolean) => {
    await fetch(`/api/conversations/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ archived }) });
    // If we archived the active conversation, clear the chat view.
    if (archived && id === activeId) {
      reset();
      setMessages([]);
    }
    refreshConversations();
    toast.success(archived ? "Conversation archived" : "Conversation restored");
  }, [refreshConversations, activeId, reset, setMessages]);

  const rename = useCallback(async (id: string, title: string) => {
    await fetch(`/api/conversations/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ title }) });
    refreshConversations();
  }, [refreshConversations]);

  const exportReport = useCallback(async (format: "markdown" | "json" = "markdown") => {
    if (!activeId) { toast.error("No active conversation to export."); return; }
    try {
      const r = await fetch("/api/export", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ conversationId: activeId, format }) });
      if (!r.ok) throw new Error(await r.text());
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `vexor-audit-${activeId}.${format === "json" ? "json" : "md"}`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`Audit report exported (${format.toUpperCase()})`);
    } catch (e: any) {
      toast.error("Export failed: " + e.message);
    }
  }, [activeId]);

  // ---------- the streaming send loop ----------
  const send = useCallback(async (text: string) => {
    if (streaming) return;
    let convId = activeId;
    if (!convId) {
      try {
        const r = await fetch("/api/conversations", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({}) });
        const raw = await r.text();
        let data: any;
        try {
          data = raw ? JSON.parse(raw) : {};
        } catch {
          throw new Error(`Server returned an invalid response (status ${r.status}).`);
        }
        if (!r.ok) throw new Error(data?.error || `Server error (status ${r.status}).`);
        convId = data.id;
        setActive(convId);
      } catch (e: any) {
        toast.error("Failed to create conversation: " + e.message);
        return;
      }
    }

    // If editing an existing message, truncate messages from that index onward.
    if (editingFromIndexRef.current !== null && convId) {
      const editIdx = editingFromIndexRef.current;
      editingFromIndexRef.current = null;
      const kept = useChatStore.getState().messages.slice(0, editIdx);
      setMessages(kept);
      // Delete the trailing messages from the DB.
      try {
        const conv = await fetch(`/api/conversations/${convId}`).then((r) => r.json());
        const allMsgs = conv.messages || [];
        const toDelete = allMsgs.slice(editIdx);
        for (const m of toDelete) {
          await fetch(`/api/conversations/${convId}/messages/${m.id}`, { method: "DELETE" });
        }
      } catch {}
    }

    // optimistic user message
    const userMsg: ChatMessage = { role: "user", content: text, metadata: { kind: "text" } };
    appendMessage(userMsg);

    setStreaming(true);
    setThinking(false);
    const ac = new AbortController();
    abortRef.current = ac;

    // Working display list — we mutate this as events arrive.
    const display: ChatMessage[] = [...useChatStore.getState().messages];
    let textIdx: number | null = null;
    let thinkingIdx: number | null = null;

    const sealThought = () => {
      if (thinkingIdx === null) return;
      const full = thinkingReasoningRef.current.trim();
      if (full) {
        const dur = thinkingStartRef.current ? Date.now() - thinkingStartRef.current : 0;
        display[thinkingIdx] = { role: "assistant", content: full, metadata: { kind: "thought", durationMs: dur } };
      } else {
        display.splice(thinkingIdx, 1);
        if (textIdx !== null && textIdx > thinkingIdx) textIdx -= 1;
      }
      thinkingIdx = null;
      thinkingReasoningRef.current = "";
      thinkingStartRef.current = null;
      setThinking(false);
      setMessages([...display]);
    };

    try {
      const resp = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ conversationId: convId, message: text }),
        signal: ac.signal,
      });
      if (!resp.ok || !resp.body) throw new Error(`chat request failed: ${resp.status}`);

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      // After done, refresh findings/exploits/conversations from the server so
      // the persisted state matches what the loop filed.
      let sawDone = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n\n");
        buf = lines.pop() || "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const payload = line.slice(6).trim();
          if (!payload) continue;
          let ev: AgentEvent;
          try { ev = JSON.parse(payload); } catch { continue; }

          switch (ev.type) {
            case "reasoning": {
              if (!thinking) setThinking(true);
              if (thinkingStartRef.current === null) thinkingStartRef.current = Date.now();
              thinkingReasoningRef.current += ev.content;
              setThinkingSnippet(thinkingReasoningRef.current.slice(-280));
              if (thinkingIdx === null) {
                display.push({ role: "assistant", content: "Thinking…", metadata: { kind: "thought" } });
                thinkingIdx = display.length - 1;
                textIdx = null;
              }
              setMessages([...display]);
              break;
            }
            case "text": {
              if (thinkingIdx !== null) {
                sealThought();
              }
              // Accumulate into a RAW buffer (including <tool_call> tags) so
              // partial blocks don't lose their opening tag mid-stream.
              // Then compute the display version by stripping tool_call blocks.
              if (textIdx !== null) {
                const meta = display[textIdx].metadata || {};
                const rawBuf = (meta._rawBuf as string || "") + ev.content;
                const cleaned = stripToolCallsFromText(rawBuf);
                display[textIdx] = { ...display[textIdx], content: cleaned, metadata: { ...meta, _rawBuf: rawBuf, kind: "text" } };
              } else {
                const rawBuf = ev.content;
                const cleaned = stripToolCallsFromText(rawBuf);
                if (cleaned || rawBuf.includes("<tool_call>")) {
                  display.push({ role: "assistant", content: cleaned, metadata: { kind: "text", _rawBuf: rawBuf } });
                  textIdx = display.length - 1;
                }
              }
              setMessages([...display]);
              break;
            }
            case "tool_call": {
              sealThought();
              if (textIdx !== null) {
                if (!display[textIdx].content?.trim()) display.splice(textIdx, 1);
                textIdx = null;
              }
              const name = ev.name;
              const args = ev.arguments;
              display.push({
                role: "assistant",
                content: `${name}(${args})\n\n⏳ Running...`,
                metadata: { kind: "tool", toolName: name, toolArgs: args },
              });
              setMessages([...display]);
              break;
            }
            case "tool_output": {
              // Find the last tool message and update it.
              for (let i = display.length - 1; i >= 0; i--) {
                if (display[i].metadata?.kind === "tool" && display[i].metadata?.toolName === ev.name) {
                  display[i] = {
                    ...display[i],
                    content: `${display[i].metadata?.toolName}(${display[i].metadata?.toolArgs})\n\n**Output:**\n${ev.content}`,
                  };
                  break;
                }
              }
              setMessages([...display]);
              // Pull fresh findings/exploits from the server so the panels update.
              refreshRecon(convId!);
              break;
            }
            case "error": {
              sealThought();
              display.push({ role: "assistant", content: ev.content, metadata: { kind: "error" } });
              setMessages([...display]);
              toast.error(ev.content);
              break;
            }
            case "done": {
              sawDone = true;
              sealThought();
              setProgress(null);
              break;
            }
            case "progress": {
              setProgress({ iteration: ev.iteration + 1, maxIterations: ev.maxIterations });
              break;
            }
          }
        }
      }
      if (!sawDone) {
        // server closed without explicit done — seal any in-flight bubbles
        sealThought();
      }
      refreshConversations();
      refreshRecon(convId!);
    } catch (e: any) {
      if (e.name === "AbortError") {
        toast.info("Run stopped.");
      } else {
        toast.error("Stream failed: " + e.message);
      }
      sealThought();
    } finally {
      setStreaming(false);
      setThinking(false);
      abortRef.current = null;
    }
  }, [streaming, activeId, appendMessage, setActive, setMessages, setThinking, refreshConversations, thinking]);

  const lastDupeCountRef = useRef(0);

  const refreshRecon = useCallback(async (convId: string) => {
    try {
      const r = await fetch(`/api/conversations/${convId}`);
      if (!r.ok) return;
      const data = await r.json();
      // Merge: replace with server truth.
      setFindings(data.findings || []);
      setExploits(data.exploits || []);

      // Check for cross-audit duplicates — toast if a new duplicate appeared.
      try {
        const dr = await fetch("/api/findings/duplicates");
        const dj = await dr.json();
        const newCount = (dj.groups || []).filter((g: any) =>
          g.occurrences.some((o: any) => o.conversationId === convId)
        ).length;
        if (newCount > lastDupeCountRef.current && lastDupeCountRef.current !== -1 && newCount > 0) {
          const delta = newCount - lastDupeCountRef.current;
          toast.warning(`⚠ ${delta} finding${delta > 1 ? "s" : ""} match${delta > 1 ? "" : "es"} an existing cross-audit duplicate`, {
            description: "Likely un-rotated credential — check the Dupes tab.",
          });
        }
        lastDupeCountRef.current = newCount;
      } catch {}
    } catch {}
  }, [setFindings, setExploits]);

  const stop = useCallback(() => {
    abortRef.current?.abort();
    setStreaming(false);
    setThinking(false);
    setProgress(null);
  }, [setStreaming, setThinking, setProgress]);

  // Regenerate the last assistant response: drop trailing assistant messages
  // back to the last user message, then re-run the loop with that user prompt.
  const regenerate = useCallback(async () => {
    if (streaming || !activeId || messages.length === 0) return;
    // Find the last user message.
    let lastUserIdx = -1;
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === "user") { lastUserIdx = i; break; }
    }
    if (lastUserIdx < 0) return;
    const userText = messages[lastUserIdx].content;
    // Truncate the display + DB to just before that user message.
    const kept = messages.slice(0, lastUserIdx);
    setMessages(kept);
    // Delete the trailing messages from the DB (lastUserIdx onward).
    try {
      const conv = await fetch(`/api/conversations/${activeId}`).then((r) => r.json());
      const allMsgs = conv.messages || [];
      const toDelete = allMsgs.slice(lastUserIdx);
      for (const m of toDelete) {
        await fetch(`/api/conversations/${activeId}/messages/${m.id}`, { method: "DELETE" });
      }
    } catch {}
    // Re-send the user prompt (it will be re-persisted by the chat route).
    await send(userText);
  }, [streaming, activeId, messages, setMessages, send]);

  // Edit a user message: populate the composer + set a truncation index.
  // When the user re-sends, messages from that index onward are deleted first.
  const editingFromIndexRef = useRef<number | null>(null);
  const editMessage = useCallback((index: number, content: string) => {
    if (streaming) return;
    editingFromIndexRef.current = index;
    setComposerValue(content);
    setTimeout(() => {
      const ta = document.querySelector("textarea");
      ta?.focus();
      ta?.setSelectionRange(content.length, content.length);
    }, 0);
    toast.info("Editing message — press Enter to re-run from this point");
  }, [streaming, setComposerValue]);

  // Clear all messages in the active conversation (keeps the conversation shell).
  const clearConversation = useCallback(async () => {
    if (!activeId) return;
    try {
      const conv = await fetch(`/api/conversations/${activeId}`).then((r) => r.json());
      for (const m of conv.messages || []) {
        await fetch(`/api/conversations/${activeId}/messages/${m.id}`, { method: "DELETE" });
      }
      setMessages([]);
      setFindings([]);
      setExploits([]);
      toast.success("Conversation cleared");
    } catch (e: any) {
      toast.error("Clear failed: " + e.message);
    }
  }, [activeId, setMessages, setFindings, setExploits]);

  const pickLandingChip = (prompt: string) => {
    setComposerValue(prompt);
    setTimeout(() => {
      const ta = document.querySelector("textarea");
      ta?.focus();
      ta?.setSelectionRange(prompt.length, prompt.length);
    }, 0);
  };

  const onSaveSettings = useCallback(async (patch: Partial<AppSettings>) => {
    const r = await fetch("/api/settings", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(patch) });
    const s = await r.json();
    setSettings({ ...DEFAULT_SETTINGS, ...s });
    patchSettings(patch);
    toast.success("Settings saved");
  }, [setSettings, patchSettings]);

  // ---------- theme toggle ----------
  const toggleTheme = () => {
    if (!settings) return;
    const next = settings.theme === "dark" ? "light" : "dark";
    onSaveSettings({ theme: next });
  };

  const hasActiveChat = messages.length > 0;
  const showLanding = !hasActiveChat && !streaming;

  return (
    <div className="vx-scanlines vx-glass-ambient h-screen flex flex-col bg-[var(--vx-bg)] text-[var(--vx-text)]">
      {/* ===== topbar ===== */}
      <header className="flex-shrink-0 h-12 flex items-center gap-2 px-3 vx-glass z-30 rounded-none">
        <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-1.5 rounded hover:bg-[var(--vx-panel-2)] text-[var(--vx-text-muted)]" aria-label="Toggle sidebar">
          <Menu className="w-4 h-4" />
        </button>
        <div className="flex items-center gap-1.5">
          <span className="vx-glow w-6 h-6 rounded flex items-center justify-center text-xs font-bold border border-[color-mix(in_oklab,var(--vx-accent)_40%,transparent)] bg-[color-mix(in_oklab,var(--vx-accent)_10%,transparent)] text-[var(--vx-accent)]">V</span>
          <span className="font-semibold text-sm">
            <span className="text-[var(--vx-accent)]">V</span>e<span className="text-[var(--vx-accent)]">x</span>or
          </span>
          <span className="hidden sm:inline text-[11px] text-[var(--vx-text-muted)] vx-mono">· AI Security Agent</span>
        </div>
        <div className="flex items-center gap-1.5 ml-3 text-[11px] text-[var(--vx-text-muted)] vx-mono">
          <span className={`w-1.5 h-1.5 rounded-full ${streaming ? "bg-[var(--vx-accent)] vx-pulse" : "bg-[var(--vx-ok)]"}`} />
          {streaming ? "auditing…" : "ready"}
          {streaming && progress && (
            <span className="flex items-center gap-1.5 ml-1">
              <span className="text-[var(--vx-accent)]">·</span>
              <span className="text-[var(--vx-accent)]">turn {progress.iteration}/{progress.maxIterations}</span>
              {progress.actionCount !== undefined && progress.actionCount > 0 && (
                <span className="text-[var(--vx-cyan)]">· {progress.actionCount} action{progress.actionCount !== 1 ? "s" : ""}</span>
              )}
              <div className="w-16 h-1 rounded-full bg-[var(--vx-bg)] overflow-hidden">
                <div
                  className="h-full bg-[var(--vx-accent)] transition-all duration-300"
                  style={{ width: `${Math.min(100, (progress.iteration / progress.maxIterations) * 100)}%` }}
                />
              </div>
            </span>
          )}
        </div>
        <div className="flex-1" />
        <button onClick={openPalette} className="hidden sm:flex items-center gap-1.5 px-2 py-1 rounded border border-[var(--vx-border)] text-[11px] text-[var(--vx-text-muted)] hover:text-[var(--vx-accent)] hover:border-[color-mix(in_oklab,var(--vx-accent)_40%,transparent)] vx-mono">
          <CommandIcon className="w-3 h-3" /> ⌘K
        </button>
        <button onClick={toggleTheme} className="p-1.5 rounded hover:bg-[var(--vx-panel-2)] text-[var(--vx-text-muted)]" aria-label="Toggle theme">
          {settings?.theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>
      </header>

      {/* ===== body ===== */}
      <div className="flex-1 flex overflow-hidden">
        <Sidebar
          onNewChat={newChat}
          onOpenTemplates={() => setTemplatePickerOpen(true)}
          onPick={pickConversation}
          onDelete={deleteConversation}
          onTogglePin={togglePin}
          onToggleFavorite={toggleFavorite}
          onToggleArchive={toggleArchive}
          onRename={rename}
          onExport={exportReport}
          onTagsChange={refreshConversations}
        />

        <main className="flex-1 flex min-w-0">
          {/* chat column */}
          <section className={`flex-1 flex flex-col min-w-0 ${showPanel ? "lg:flex-1" : ""}`}>
            {/* Chat header — conversation title + actions (only when a chat is active) */}
            {hasActiveChat && (
              <div className="flex-shrink-0 flex items-center gap-2 px-3 py-2 vx-glass">
                <span className="text-xs text-[var(--vx-text-muted)] vx-mono truncate flex-1">
                  {conversations.find((c) => c.id === activeId)?.title || "conversation"}
                </span>
                <span className="text-[10px] text-[var(--vx-text-muted)] vx-mono">{messages.length} msg</span>
                <button
                  onClick={regenerate}
                  disabled={streaming || messages.length === 0}
                  className="flex items-center gap-1 text-[10px] px-2 py-1 rounded text-[var(--vx-text-muted)] hover:text-[var(--vx-accent)] hover:bg-[var(--vx-panel-2)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  title="Regenerate last response"
                >
                  <RotateCw className="w-3 h-3" /> Retry
                </button>
                <button
                  onClick={clearConversation}
                  disabled={streaming}
                  className="flex items-center gap-1 text-[10px] px-2 py-1 rounded text-[var(--vx-text-muted)] hover:text-[var(--sev-critical)] hover:bg-[var(--vx-panel-2)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  title="Clear all messages"
                >
                  <Trash2 className="w-3 h-3" /> Clear
                </button>
              </div>
            )}
            <div ref={scrollRef} className="flex-1 overflow-y-auto vx-scroll px-3 py-4">
              {showLanding ? (
                <Landing onPick={pickLandingChip} />
              ) : (
                <div className="max-w-4xl mx-auto flex flex-col gap-3">
                  {messages.map((m, i) => {
                    const isLastAssistant = !streaming && m.role === "assistant" && i === messages.length - 1;
                    return (
                      <MessageBubble
                        key={i}
                        msg={m}
                        streaming={streaming && i === messages.length - 1}
                        actions={{ onRegenerate: regenerate, isLastAssistant, onEdit: (content) => editMessage(i, content) }}
                      />
                    );
                  })}
                  {thinking && <ThinkingBubble snippet={thinkingSnippet} frame={thinkingFrame} />}
                </div>
              )}
            </div>
            <Composer onSend={send} onStop={stop} streaming={streaming} value={composerValue} onChange={setComposerValue} placeholder={hasActiveChat ? undefined : "Paste code, a repo URL, or a CVE id — press Enter to send"} />
          </section>

          {/* right panel (Recon / Tester / Agent / Settings / CLI / Stats) */}
          {showPanel && (
            <aside className="fixed inset-0 z-40 lg:static lg:z-auto lg:flex w-full lg:w-[420px] xl:w-[480px] flex-shrink-0 vx-glass-strong flex-col vx-slide-in-right">
              <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--vx-border)]">
                <div className="flex items-center gap-1.5 text-sm font-semibold text-[var(--vx-accent)] capitalize">
                  <PanelRightClose className="w-4 h-4" /> {sidebarTab}
                </div>
                <button onClick={() => setShowPanel(false)} className="p-1.5 rounded hover:bg-[var(--vx-panel-2)] text-[var(--vx-text-muted)] hover:text-[var(--vx-accent)]" aria-label="Close panel">
                  <PanelRightClose className="w-4 h-4" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto vx-scroll p-3">
                {sidebarTab === "recon" && (
                  <div className="flex flex-col gap-4">
                    <ReconSummary findings={findings} exploits={exploits} />
                    <FindingsVault findings={findings} conversationId={activeId} onChanged={() => activeId && refreshRecon(activeId)} />
                    <ExploitCatalog exploits={exploits} conversationId={activeId} onChanged={() => activeId && refreshRecon(activeId)} />
                  </div>
                )}
                {sidebarTab === "history" && <ToolHistory conversationId={activeId} />}
                {sidebarTab === "search" && <FindingsSearch onPickConversation={pickConversation} />}
                {sidebarTab === "timeline" && <SeverityTimeline />}
                {sidebarTab === "duplicates" && <DuplicatesPanel onPickConversation={pickConversation} />}
                {sidebarTab === "tester" && <ToolTester conversationId={activeId} scope={settings?.targetScope || ""} />}
                {sidebarTab === "agent" && settings && <AgentControlsPanel settings={settings} onSave={onSaveSettings as any} />}
                {sidebarTab === "settings" && settings && <SettingsPanel settings={settings} onSave={onSaveSettings} />}
                {sidebarTab === "cli" && <CliPanel />}
                {sidebarTab === "stats" && <StatsDashboard convId={activeId} />}
              </div>
            </aside>
          )}
        </main>
      </div>

      {/* ===== panel toggle strip + footer ===== */}
      <footer className="flex-shrink-0 vx-footer">
        <div className="flex items-center gap-1 px-2 py-1 border-b border-[var(--vx-border)] overflow-x-auto vx-scroll">
          {([
            { id: "chats", icon: Menu, label: "Chats" },
            { id: "recon", icon: Bug, label: "Recon" },
            { id: "timeline", icon: LineChart, label: "Timeline" },
            { id: "search", icon: Search, label: "Search" },
            { id: "duplicates", icon: CopyCheck, label: "Dupes" },
            { id: "history", icon: History, label: "History" },
            { id: "tester", icon: FlaskConical, label: "Tester" },
            { id: "agent", icon: Brain, label: "Agent" },
            { id: "stats", icon: Activity, label: "Stats" },
            { id: "settings", icon: SettingsIcon, label: "Settings" },
            { id: "cli", icon: Terminal, label: "Toolkit" },
          ] as const).map((t) => (
            <button
              key={t.id}
              onClick={() => {
                setSidebarTab(t.id);
                setSidebarOpen(true);
                if (t.id !== "chats") setShowPanel(true);
                else setShowPanel(false);
              }}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] whitespace-nowrap vx-glass-btn ${
                sidebarTab === t.id && (t.id === "chats" ? sidebarOpen : showPanel)
                  ? "bg-[color-mix(in_oklab,var(--vx-accent)_18%,transparent)] text-[var(--vx-accent)]"
                  : "text-[var(--vx-text-muted)]"
              }`}
            >
              <t.icon className="w-3 h-3" /> {t.label}
              {t.id === "recon" && (findings.length + exploits.length > 0) && (
                <span className="ml-0.5 text-[10px] vx-mono">{findings.length + exploits.length}</span>
              )}
            </button>
          ))}
          <div className="flex-1" />
          {showPanel && (
            <button onClick={() => setShowPanel(false)} className="hidden lg:flex items-center gap-1 px-2 py-1 rounded text-[11px] text-[var(--vx-text-muted)] hover:text-[var(--vx-accent)]">
              <PanelRightClose className="w-3 h-3" /> Hide panel
            </button>
          )}
          {!showPanel && (
            <button onClick={() => setShowPanel(true)} className="hidden lg:flex items-center gap-1 px-2 py-1 rounded text-[11px] text-[var(--vx-text-muted)] hover:text-[var(--vx-accent)]">
              <PanelRightOpen className="w-3 h-3" /> Show panel
            </button>
          )}
        </div>
        <div className="flex items-center justify-between px-3 py-1 text-[10px] text-[var(--vx-text-muted)] vx-mono">
          <span>Vexor · autonomous offensive-security agent · defensive use only</span>
          <span className="hidden sm:inline">{conversations.length} chats · {findings.length} findings · {exploits.length} exploits</span>
        </div>
      </footer>

      <CommandPalette
        key={paletteKey}
        onNewChat={newChat}
        onDeleteActive={() => activeId && deleteConversation(activeId)}
        onExport={exportReport}
        onPickConversation={pickConversation}
      />

      <ShortcutsOverlay open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />

      <TemplatePicker open={templatePickerOpen} onClose={() => setTemplatePickerOpen(false)} onPick={newChatFromTemplate} />
    </div>
  );
}

// Severity summary header for the Recon panel — compact at-a-glance counts.
function ReconSummary({ findings, exploits }: { findings: import("@/lib/types").Finding[]; exploits: import("@/lib/types").Exploit[] }) {
  const SEVS = ["critical", "high", "medium", "low", "info"] as const;
  const fBySev = SEVS.map((s) => ({ sev: s, count: findings.filter((f) => f.severity === s).length }));
  const eBySev = SEVS.map((s) => ({ sev: s, count: exploits.filter((e) => e.severity === s).length }));
  const total = findings.length + exploits.length;
  if (total === 0) return null;
  const topSev = SEVS.find((s) => findings.some((f) => f.severity === s) || exploits.some((e) => e.severity === s));

  return (
    <div className={`rounded-lg border p-3 ${
      topSev === "critical" ? "border-[color-mix(in_oklab,var(--sev-critical)_40%,transparent)] bg-[color-mix(in_oklab,var(--sev-critical)_6%,transparent)]" :
      topSev === "high" ? "border-[color-mix(in_oklab,var(--sev-high)_40%,transparent)] bg-[color-mix(in_oklab,var(--sev-high)_6%,transparent)]" :
      "border-[var(--vx-border)] bg-[var(--vx-panel-2)]"
    }`}>
      <div className="flex items-center gap-2 mb-2">
        <span className={`vx-sev-dot vx-sev-${topSev}`} />
        <span className="text-sm font-semibold capitalize">Overall risk: {topSev}</span>
        <span className="ml-auto text-[10px] text-[var(--vx-text-muted)] vx-mono">{total} total</span>
      </div>
      <div className="grid grid-cols-5 gap-1.5">
        {SEVS.map((s, i) => {
          const f = fBySev[i].count;
          const e = eBySev[i].count;
          const n = f + e;
          return (
            <div key={s} className={`rounded-md border border-[color-mix(in_oklab,var(--sev-${s})_30%,transparent)] bg-[color-mix(in_oklab,var(--sev-${s})_8%,transparent)] p-1.5 text-center`}>
              <div className={`text-lg font-bold vx-mono text-[var(--sev-${s})]`}>{n}</div>
              <div className="text-[9px] uppercase tracking-wider text-[var(--vx-text-muted)] font-semibold">{s}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
