"use client";

import { create } from "zustand";
import type {
  AppSettings,
  ChatMessage,
  ConversationSummary,
  Exploit,
  Finding,
} from "./types";
import { DEFAULT_SETTINGS } from "./types";

interface SettingsState {
  settings: AppSettings | null;
  setSettings: (s: AppSettings) => void;
  patchSettings: (patch: Partial<AppSettings>) => void;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  settings: null,
  setSettings: (s) => set({ settings: s }),
  patchSettings: (patch) =>
    set((state) => (state.settings ? { settings: { ...state.settings, ...patch } } : state)),
}));

interface ChatState {
  conversations: ConversationSummary[];
  activeId: string | null;
  messages: ChatMessage[];
  findings: Finding[];
  exploits: Exploit[];
  streaming: boolean;
  thinking: boolean;
  progress: { iteration: number; maxIterations: number } | null;

  setConversations: (c: ConversationSummary[]) => void;
  setActive: (id: string | null) => void;
  setMessages: (m: ChatMessage[]) => void;
  appendMessage: (m: ChatMessage) => void;
  updateLastAssistant: (content: string, meta?: Partial<ChatMessage["metadata"]>) => void;
  setFindings: (f: Finding[]) => void;
  addFindings: (f: Finding[]) => void;
  setExploits: (e: Exploit[]) => void;
  upsertExploit: (e: Exploit) => void;
  setStreaming: (s: boolean) => void;
  setThinking: (t: boolean) => void;
  setProgress: (p: { iteration: number; maxIterations: number } | null) => void;
  reset: () => void;
}

export const useChatStore = create<ChatState>((set) => ({
  conversations: [],
  activeId: null,
  messages: [],
  findings: [],
  exploits: [],
  streaming: false,
  thinking: false,
  progress: null,

  setConversations: (c) => set({ conversations: c }),
  setActive: (id) => set({ activeId: id }),
  setMessages: (m) => set({ messages: m }),
  appendMessage: (m) => set((s) => ({ messages: [...s.messages, m] })),
  updateLastAssistant: (content, meta) =>
    set((s) => {
      const msgs = [...s.messages];
      for (let i = msgs.length - 1; i >= 0; i--) {
        if (msgs[i].role === "assistant") {
          msgs[i] = { ...msgs[i], content, metadata: { ...msgs[i].metadata, ...meta } };
          break;
        }
      }
      return { messages: msgs };
    }),
  setFindings: (f) => set({ findings: f }),
  addFindings: (f) =>
    set((s) => {
      const seen = new Set(s.findings.map((x) => x.id));
      const merged = [...s.findings];
      for (const item of f) {
        if (!seen.has(item.id)) {
          seen.add(item.id);
          merged.push(item);
        }
      }
      return { findings: merged };
    }),
  setExploits: (e) => set({ exploits: e }),
  upsertExploit: (e) =>
    set((s) => {
      const idx = s.exploits.findIndex((x) => x.id === e.id);
      if (idx >= 0) {
        const copy = [...s.exploits];
        copy[idx] = e;
        return { exploits: copy };
      }
      return { exploits: [...s.exploits, e] };
    }),
  setStreaming: (streaming) => set({ streaming }),
  setThinking: (thinking) => set({ thinking }),
  setProgress: (progress) => set({ progress }),
  reset: () => set({ messages: [], findings: [], exploits: [], activeId: null, streaming: false, thinking: false, progress: null }),
}));

// UI state: sidebar open, active tab, command palette open
interface UIState {
  sidebarOpen: boolean;
  sidebarTab: "chats" | "recon" | "timeline" | "search" | "duplicates" | "history" | "tester" | "agent" | "stats" | "settings" | "cli";
  paletteOpen: boolean;
  setSidebarOpen: (o: boolean) => void;
  setSidebarTab: (t: UIState["sidebarTab"]) => void;
  setPaletteOpen: (o: boolean) => void;
}

export const useUIStore = create<UIState>((set) => ({
  sidebarOpen: false,
  sidebarTab: "chats",
  paletteOpen: false,
  setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
  setSidebarTab: (sidebarTab) => set({ sidebarTab }),
  setPaletteOpen: (paletteOpen) => set({ paletteOpen }),
}));

// initialize settings defaults so ThemeSync has something before fetch resolves
if (typeof window !== "undefined") {
  useSettingsStore.setState({ settings: DEFAULT_SETTINGS });
}
