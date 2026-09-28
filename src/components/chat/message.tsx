"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, Copy, Check, Wrench, Brain, AlertTriangle, User, Shield, RotateCw, Trash2, Pencil } from "lucide-react";
import type { ChatMessage } from "@/lib/types";
import { Markdown } from "@/components/markdown";

const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

interface MessageActions {
  onCopy?: (content: string) => void;
  onRegenerate?: () => void;
  onEdit?: (content: string) => void;
  isLastAssistant?: boolean;
}

export function MessageBubble({ msg, streaming, actions }: { msg: ChatMessage; streaming?: boolean; actions?: MessageActions }) {
  const meta = msg.metadata || {};
  const kind = meta.kind || "text";

  if (kind === "tool") {
    return <ToolCard name={meta.toolName || "tool"} args={meta.toolArgs || ""} content={msg.content} />;
  }
  if (kind === "thought") {
    return <ThoughtCard content={msg.content} durationMs={meta.durationMs} />;
  }
  if (kind === "error") {
    return (
      <div className="vx-fade-in flex items-start gap-2 px-4 py-3 rounded-lg border border-[color-mix(in_oklab,var(--sev-critical)_40%,transparent)] bg-[color-mix(in_oklab,var(--sev-critical)_8%,transparent)]">
        <AlertTriangle className="w-4 h-4 text-[var(--sev-critical)] mt-0.5 flex-shrink-0" />
        <div className="vx-prose text-sm text-[var(--sev-critical)] flex-1">{msg.content}</div>
        {actions?.onCopy && <CopyButton text={msg.content} small />}
      </div>
    );
  }

  const isUser = msg.role === "user";
  return (
    <div className={`vx-fade-in group flex gap-3 ${isUser ? "flex-row-reverse" : ""}`}>
      <div className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center border ${
        isUser
          ? "border-[var(--vx-border)] bg-[var(--vx-panel-2)] text-[var(--vx-text-muted)]"
          : "border-[color-mix(in_oklab,var(--vx-accent)_40%,transparent)] bg-[color-mix(in_oklab,var(--vx-accent)_12%,transparent)] text-[var(--vx-accent)] vx-glow"
      }`}>
        {isUser ? <User className="w-3.5 h-3.5" /> : <Shield className="w-3.5 h-3.5" />}
      </div>
      <div className={`min-w-0 max-w-[calc(100%-2.75rem)] ${isUser ? "items-end text-right" : ""} flex flex-col`}>
        <div className={`flex items-center gap-2 mb-1 ${isUser ? "flex-row-reverse" : ""}`}>
          <span className={`text-[10px] uppercase tracking-wider font-semibold ${isUser ? "text-[var(--vx-text-muted)]" : "text-[var(--vx-accent)]"}`}>
            {isUser ? "You" : "Vexor"}
          </span>
          {msg.createdAt && (
            <span className="text-[9px] text-[var(--vx-text-muted)] vx-mono opacity-60">
              {new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </span>
          )}
        </div>
        <div className={`inline-block vx-glass-card vx-glass-hover px-3.5 py-2.5 ${
          isUser
            ? "bg-[color-mix(in_oklab,var(--vx-accent)_10%,transparent)]"
            : ""
        }`}>
          {isUser ? (
            <div className="vx-mono text-sm whitespace-pre-wrap break-words text-left">{msg.content}</div>
          ) : (
            <Markdown content={msg.content || (streaming ? "…" : "")} />
          )}
        </div>
        {/* Message action bar — appears on hover (desktop) or always (last assistant) */}
        {!streaming && msg.content && (
          <div className={`flex items-center gap-1 mt-1 opacity-0 group-hover:opacity-100 transition-opacity ${isUser ? "flex-row-reverse" : ""} ${actions?.isLastAssistant ? "opacity-100" : ""}`}>
            <CopyButton text={msg.content} small />
            {isUser && actions?.onEdit && (
              <button
                onClick={() => actions.onEdit!(msg.content)}
                className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded text-[var(--vx-text-muted)] hover:text-[var(--vx-cyan)] hover:bg-[var(--vx-panel-2)] transition-colors"
                title="Edit message and re-run"
              >
                <Pencil className="w-3 h-3" /> Edit
              </button>
            )}
            {!isUser && actions?.isLastAssistant && actions.onRegenerate && (
              <button
                onClick={actions.onRegenerate}
                className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded text-[var(--vx-text-muted)] hover:text-[var(--vx-accent)] hover:bg-[var(--vx-panel-2)] transition-colors"
                title="Regenerate response"
              >
                <RotateCw className="w-3 h-3" /> Retry
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// Live "Thinking…" indicator that streams braille spinner frames.
export function ThinkingBubble({ snippet, frame }: { snippet?: string; frame: number }) {
  return (
    <div className="vx-fade-in flex gap-3">
      <div className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center border border-[color-mix(in_oklab,var(--vx-accent)_40%,transparent)] bg-[color-mix(in_oklab,var(--vx-accent)_12%,transparent)] text-[var(--vx-accent)] vx-glow">
        <Brain className="w-3.5 h-3.5" />
      </div>
      <div className="flex flex-col">
        <div className="text-[10px] uppercase tracking-wider mb-1 text-[var(--vx-accent)] font-semibold">Thinking</div>
        <div className="inline-block vx-glass-card px-3.5 py-2.5 relative overflow-hidden">
          {/* Animated top border sweep while thinking */}
          <div className="absolute top-0 left-0 h-px w-full bg-gradient-to-r from-transparent via-[var(--vx-accent)] to-transparent vx-thinking-sweep" />
          <span className="vx-thinking-indicator text-lg">{SPINNER_FRAMES[frame % SPINNER_FRAMES.length]}</span>
          <span className="vx-thinking-indicator ml-2">reasoning…</span>
          {snippet && <div className="vx-thinking-snippet vx-clamp-2 mt-1">{snippet}</div>}
        </div>
      </div>
    </div>
  );
}

function ThoughtCard({ content, durationMs }: { content: string; durationMs?: number }) {
  const [open, setOpen] = useState(false);
  const dur = durationMs && durationMs >= 1000 ? ` · ${(durationMs / 1000).toFixed(0)}s` : "";
  return (
    <div className="vx-fade-in">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-[var(--vx-text-muted)] hover:text-[var(--vx-accent)] transition-colors group"
      >
        {open ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />}
        <Brain className="w-3 h-3" /> Thought{dur}
      </button>
      {open && (
        <div className="mt-1.5 ml-5 pl-3 border-l-2 border-[color-mix(in_oklab,var(--vx-accent)_30%,transparent)] vx-thinking-snippet whitespace-pre-wrap text-[var(--vx-text-muted)]">
          {content}
        </div>
      )}
    </div>
  );
}

function ToolCard({ name, args, content }: { name: string; args: string; content: string }) {
  const [open, setOpen] = useState(false);
  // Extract "Output:" section if present, else show whole content.
  const parts = content.split(/\n?\n?\*\*Output:\*\*\n?/);
  const callLine = parts[0]?.trim() || content;
  const output = parts[1]?.trim() || "";
  const isRunning = /Running\.\.\.$/.test(content);
  return (
    <div className="vx-tool-card vx-fade-in">
      <div className="vx-tool-card-head" onClick={() => setOpen((o) => !o)}>
        {open ? <ChevronDown className="w-3 h-3 text-[var(--vx-text-muted)]" /> : <ChevronRight className="w-3 h-3 text-[var(--vx-text-muted)] transition-transform group-hover:translate-x-0.5" />}
        <Wrench className="w-3 h-3 text-[var(--vx-accent)]" />
        <span className="vx-mono text-[var(--vx-accent)] font-semibold">{name}</span>
        <span className="text-[var(--vx-text-muted)] vx-mono text-[0.72rem] vx-clamp-2 flex-1">{args}</span>
        {isRunning && <span className="vx-pulse text-[var(--vx-accent)] text-[10px] font-medium">running</span>}
        {!isRunning && output && <span className="text-[var(--vx-text-muted)] text-[10px] vx-mono">{output.length.toLocaleString()} chars</span>}
      </div>
      {open && (
        <div className="vx-tool-card-body vx-scroll">
          <div className="text-[var(--vx-text-muted)] mb-2 vx-mono text-[0.72rem]">{callLine}</div>
          {output && (
            <>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[var(--vx-text-muted)] uppercase text-[10px] tracking-wider font-semibold">Output</span>
                <CopyButton text={output} small />
              </div>
              <div className="text-[var(--vx-text)]">{output}</div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function CopyButton({ text, small }: { text: string; small?: boolean }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };
  if (small) {
    return (
      <button
        onClick={copy}
        className={`flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded transition-colors ${
          copied ? "text-[var(--vx-ok)]" : "text-[var(--vx-text-muted)] hover:text-[var(--vx-accent)] hover:bg-[var(--vx-panel-2)]"
        }`}
        title={copied ? "Copied!" : "Copy"}
      >
        {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
        {copied ? "Copied" : "Copy"}
      </button>
    );
  }
  return (
    <button
      onClick={copy}
      className={`flex items-center gap-1 text-xs px-2 py-1 rounded transition-colors ${
        copied ? "text-[var(--vx-ok)]" : "text-[var(--vx-text-muted)] hover:text-[var(--vx-accent)] hover:bg-[var(--vx-panel-2)]"
      }`}
    >
      {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}
