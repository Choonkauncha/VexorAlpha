"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, FlaskConical, LogOut, RefreshCw, UserRound } from "lucide-react";
import type { SessionUserPublic } from "@/components/auth/types";

interface Props {
  user: SessionUserPublic;
  onSignOut: () => void;
  onSwitchAccount: () => void;
  onNewSandbox: () => void;
  busy?: boolean;
}

export function WorkspaceBadge({ user, onSignOut, onSwitchAccount, onNewSandbox, busy }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const label = user.kind === "sandbox" ? user.displayName : (user.email || user.displayName);
  const short = user.kind === "sandbox"
    ? user.displayName.replace(/^investor-/, "inv-")
    : (user.displayName || label);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 max-w-[220px] px-2 py-1 rounded-lg border border-[var(--vx-border)] hover:border-[color-mix(in_oklab,var(--vx-accent)_40%,transparent)] text-[11px] vx-mono"
        aria-label="Workspace menu"
      >
        {user.kind === "sandbox"
          ? <FlaskConical className="w-3 h-3 text-[var(--vx-accent)] shrink-0" />
          : <UserRound className="w-3 h-3 text-[var(--vx-cyan)] shrink-0" />}
        <span className="truncate text-[var(--vx-text)]">{short}</span>
        <span className="hidden md:inline text-[var(--vx-text-muted)] truncate">· {user.workspaceId.slice(0, 8)}</span>
        <ChevronDown className="w-3 h-3 text-[var(--vx-text-muted)] shrink-0" />
      </button>
      {open && (
        <div className="absolute right-0 mt-1.5 w-64 rounded-xl border border-[var(--vx-border)] bg-[var(--vx-panel)] shadow-xl z-50 overflow-hidden">
          <div className="px-3 py-2.5 border-b border-[var(--vx-border)]">
            <div className="text-[11px] text-[var(--vx-text-muted)] uppercase tracking-wider">Active workspace</div>
            <div className="text-xs font-semibold truncate mt-0.5">{label}</div>
            <div className="text-[10px] vx-mono text-[var(--vx-text-muted)] truncate">tenant {user.workspaceId}</div>
            <div className="mt-1 inline-flex text-[10px] px-1.5 py-0.5 rounded bg-[var(--vx-panel-2)] text-[var(--vx-text-muted)]">
              {user.kind === "sandbox" ? "Isolated investor sandbox" : "Named account"}
            </div>
          </div>
          <div className="p-1.5 flex flex-col gap-0.5">
            <button type="button" disabled={busy} onClick={() => { setOpen(false); onNewSandbox(); }} className="flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs hover:bg-[var(--vx-panel-2)] text-left disabled:opacity-50">
              <FlaskConical className="w-3.5 h-3.5 text-[var(--vx-accent)]" /> New Isolated Workspace
            </button>
            <button type="button" disabled={busy} onClick={() => { setOpen(false); onSwitchAccount(); }} className="flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs hover:bg-[var(--vx-panel-2)] text-left disabled:opacity-50">
              <RefreshCw className="w-3.5 h-3.5" /> Switch Account
            </button>
            <button type="button" disabled={busy} onClick={() => { setOpen(false); onSignOut(); }} className="flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs hover:bg-[var(--vx-panel-2)] text-[var(--sev-high)] text-left disabled:opacity-50">
              <LogOut className="w-3.5 h-3.5" /> Sign Out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
