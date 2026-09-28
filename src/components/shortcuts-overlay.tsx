"use client";

import { useEffect } from "react";
import { X, Command, Plus, Search, PanelRight, Sun, Send, ArrowUpDown } from "lucide-react";

const SHORTCUTS = [
  { group: "Global", keys: [
    { keys: ["⌘/Ctrl", "K"], label: "Open command palette", icon: Command },
    { keys: ["⌘/Ctrl", "B"], label: "Toggle sidebar", icon: PanelRight },
    { keys: ["⌘/Ctrl", "N"], label: "New conversation", icon: Plus },
    { keys: ["?"], label: "Toggle this shortcuts overlay", icon: Search },
    { keys: ["Esc"], label: "Close palette / overlay / panel", icon: X },
  ]},
  { group: "Chat", keys: [
    { keys: ["Enter"], label: "Send message", icon: Send },
    { keys: ["Shift", "Enter"], label: "Newline in composer", icon: ArrowUpDown },
    { keys: ["/"], label: "Focus composer (when not typing)", icon: Search },
  ]},
  { group: "Navigation", keys: [
    { keys: ["⌘/Ctrl", "K"], label: "→ Go to Chats / Recon / History / Tester / Stats / Settings / Toolkit", icon: Command },
  ]},
  { group: "Theme", keys: [
    { keys: ["⌘/Ctrl", "K"], label: "→ 'Switch to light/dark theme'", icon: Sun },
  ]},
];

export function ShortcutsOverlay({ open, onClose }: { open: boolean; onClose: () => void }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-2xl rounded-xl border border-[var(--vx-border)] bg-[var(--vx-panel)] shadow-2xl overflow-hidden vx-fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--vx-border)] bg-[color-mix(in_oklab,var(--vx-accent)_6%,transparent)]">
          <div className="flex items-center gap-2 text-sm font-semibold text-[var(--vx-accent)]">
            <Command className="w-4 h-4" /> Keyboard Shortcuts
          </div>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-[var(--vx-panel-2)] text-[var(--vx-text-muted)] hover:text-[var(--vx-text)]" aria-label="Close">
            <X className="w-4 h-4" />
          </button>
        </div>
        {/* Body */}
        <div className="p-4 max-h-[70vh] overflow-y-auto vx-scroll grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-5">
          {SHORTCUTS.map((section) => (
            <div key={section.group}>
              <h3 className="text-[10px] uppercase tracking-wider text-[var(--vx-text-muted)] font-semibold mb-2">{section.group}</h3>
              <ul className="flex flex-col gap-1.5">
                {section.keys.map((s, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm">
                    <s.icon className="w-3.5 h-3.5 text-[var(--vx-text-muted)] flex-shrink-0" />
                    <span className="flex-1 text-[var(--vx-text)] text-xs">{s.label}</span>
                    <span className="flex items-center gap-1">
                      {s.keys.map((k, j) => (
                        <kbd key={j} className="px-1.5 py-0.5 rounded border border-[var(--vx-border)] bg-[var(--vx-bg)] text-[10px] text-[var(--vx-accent)] vx-mono shadow-sm">{k}</kbd>
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        {/* Footer hint */}
        <div className="px-4 py-2 border-t border-[var(--vx-border)] bg-[var(--vx-panel-2)] text-center">
          <span className="text-[10px] text-[var(--vx-text-muted)] vx-mono">Press <kbd className="px-1 py-0.5 rounded border border-[var(--vx-border)] bg-[var(--vx-bg)] text-[var(--vx-accent)]">?</kbd> anywhere to toggle this overlay</span>
        </div>
      </div>
    </div>
  );
}
