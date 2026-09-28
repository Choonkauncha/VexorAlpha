"use client";

import { useRef, useEffect } from "react";
import { Send } from "lucide-react";

interface ComposerProps {
  onSend: (text: string) => void;
  onStop: () => void;
  streaming: boolean;
  placeholder?: string;
  value: string;
  onChange: (v: string) => void;
}

export function Composer({ onSend, onStop, streaming, placeholder, value, onChange }: ComposerProps) {
  const taRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 220) + "px";
  }, [value]);

  const collapsed = streaming;

  const submit = () => {
    const text = value.trim();
    if (!text || streaming) return;
    onSend(text);
    onChange("");
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  const boxShadowStr = [
    "0 1px 0 0 rgba(255,255,255,0.10) inset",
    "0 -1px 0 0 rgba(0,0,0,0.25) inset",
    "0 6px 16px -2px rgba(0,0,0,0.55)",
    "0 16px 36px -6px rgba(0,0,0,0.65)",
    "0 32px 60px -12px rgba(0,0,0,0.45)",
  ].join(", ");

  return (
    <div className="px-3 pt-1 pb-4">
      <div className="max-w-4xl mx-auto">
        {/* Floating text ABOVE */}
        <div
          className="mb-2 px-1 flex items-center justify-between text-[10px] text-[var(--vx-text-muted)] vx-mono transition-opacity duration-300"
          style={{ background: "transparent", border: "none", boxShadow: "none", opacity: collapsed ? 0 : 1, height: collapsed ? 0 : undefined, overflow: "hidden" }}
        >
          <span>Vexor · defensive-security agent</span>
          <span>↵ send · ⇧↦ newline · / focus</span>
        </div>

        {/* Container — holds either the input or the spinning stop circle */}
        <div className="relative" style={{ minHeight: "48px" }}>

          {/* Collapsed: small circular spinning stop icon */}
          <div
            className="absolute inset-0 flex items-center justify-center transition-all duration-400 ease-out"
            style={{
              opacity: collapsed ? 1 : 0,
              transform: collapsed ? "scale(1)" : "scale(0.3)",
              pointerEvents: collapsed ? "auto" : "none",
            }}
          >
            <button
              onClick={onStop}
              className="relative flex items-center justify-center rounded-full transition-all hover:scale-110"
              style={{
                width: "44px",
                height: "44px",
                border: "1px solid rgba(255,80,80,0.4)",
                background: "rgba(255,80,80,0.06)",
                boxShadow: [
                  "0 1px 0 0 rgba(255,255,255,0.10) inset",
                  "0 -1px 0 0 rgba(0,0,0,0.25) inset",
                  "0 4px 12px -2px rgba(0,0,0,0.50)",
                  "0 0 20px -4px rgba(255,80,80,0.30)",
                ].join(", "),
              }}
              aria-label="Stop"
            >
              {/* Spinning ring — the circle border animates */}
              <svg className="absolute inset-0 w-full h-full animate-spin" style={{ animationDuration: "1s" }} viewBox="0 0 44 44">
                <circle cx="22" cy="22" r="20" fill="none" stroke="rgba(255,80,80,0.15)" strokeWidth="1.5" />
                <circle cx="22" cy="22" r="20" fill="none" stroke="var(--sev-critical)" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="40 200" strokeDashoffset="0" />
              </svg>
              {/* Stop square in the center */}
              <span className="relative w-3 h-3 rounded-sm" style={{ background: "var(--sev-critical)" }} />
            </button>
          </div>

          {/* Expanded: full input box */}
          <div
            className="flex items-end gap-2 rounded-xl transition-all duration-400 ease-out"
            style={{
              borderTop: "1px solid rgba(255,255,255,0.12)",
              borderBottom: "1px solid rgba(0,0,0,0.45)",
              borderLeft: "1px solid rgba(255,255,255,0.06)",
              borderRight: "1px solid rgba(0,0,0,0.25)",
              background: "transparent",
              boxShadow: boxShadowStr,
              backdropFilter: "none",
              WebkitBackdropFilter: "none",
              opacity: collapsed ? 0 : 1,
              transform: collapsed ? "translateX(60px) scaleX(0.2)" : "translateX(0) scaleX(1)",
              transformOrigin: "left center",
              pointerEvents: collapsed ? "none" : "auto",
            }}
          >
            <span className="pl-3 pt-3 text-[var(--vx-accent)] vx-mono text-sm select-none">{">"}</span>
            <textarea
              ref={taRef}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              onKeyDown={onKeyDown}
              rows={1}
              placeholder={placeholder || "Paste code, a repo URL, or a CVE id — press Enter to send, Shift+Enter for a newline"}
              className="flex-1 bg-transparent border-0 outline-none resize-none vx-mono text-sm py-3 pr-2 placeholder:text-[var(--vx-text-muted)] vx-scroll"
            />
            <button
              onClick={submit}
              disabled={!value.trim() || streaming}
              className="m-1.5 px-3 py-2 rounded-lg text-sm font-semibold flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              style={{
                border: "1px solid rgba(100,200,180,0.25)",
                background: "transparent",
                color: "var(--vx-accent)",
              }}
              aria-label="Send"
            >
              <Send className="w-3.5 h-3.5" /> Send
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}
