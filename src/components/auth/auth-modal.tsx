"use client";

import { useState } from "react";
import { FlaskConical, KeyRound, Loader2, Shield, UserPlus } from "lucide-react";
import { toast } from "sonner";
import type { SessionUserPublic } from "@/components/auth/types";

type Mode = "signin" | "signup";

interface Props {
  onAuthenticated: (user: SessionUserPublic) => void;
}

export function AuthModal({ onAuthenticated }: Props) {
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [busy, setBusy] = useState<"auth" | "sandbox" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setBusy("auth");
    setError(null);
    try {
      const res = await fetch(mode === "signin" ? "/api/auth/signin" : "/api/auth/signup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(
          mode === "signin"
            ? { email, password }
            : { email, password, displayName: displayName || undefined },
        ),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Authentication failed.");
      onAuthenticated(data.user);
      toast.success(mode === "signin" ? "Signed in" : "Account created", {
        description: `Workspace ${data.user.displayName} is ready.`,
      });
    } catch (e: any) {
      setError(e.message || "Authentication failed.");
    } finally {
      setBusy(null);
    }
  };

  const launchSandbox = async () => {
    setBusy("sandbox");
    setError(null);
    try {
      const res = await fetch("/api/auth/sandbox", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not provision sandbox.");
      onAuthenticated(data.user);
      toast.success("Isolated investor sandbox ready", {
        description: `${data.user.displayName} — private tenant, zero shared data.`,
      });
    } catch (e: any) {
      setError(e.message || "Sandbox provisioning failed.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-[color-mix(in_oklab,var(--vx-bg)_70%,black)] backdrop-blur-md px-4">
      <div className="w-full max-w-md rounded-2xl border border-[var(--vx-border)] bg-[var(--vx-panel)] shadow-2xl overflow-hidden">
        <div className="px-6 pt-6 pb-4 border-b border-[var(--vx-border)]">
          <div className="flex items-center gap-2 mb-2">
            <span className="vx-glow w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold border border-[color-mix(in_oklab,var(--vx-accent)_40%,transparent)] bg-[color-mix(in_oklab,var(--vx-accent)_10%,transparent)] text-[var(--vx-accent)]">V</span>
            <div>
              <div className="font-semibold text-sm">Vexor</div>
              <div className="text-[11px] text-[var(--vx-text-muted)] vx-mono">Multi-tenant security workspace</div>
            </div>
          </div>
          <p className="text-xs text-[var(--vx-text-muted)] leading-relaxed">
            Every account gets a cryptographically isolated tenant. Conversations, findings, exploits, settings, and API keys never cross workspaces.
          </p>
        </div>

        <div className="p-6 space-y-4">
          <button
            type="button"
            onClick={() => void launchSandbox()}
            disabled={busy !== null}
            className="w-full flex items-center justify-center gap-2 rounded-xl border border-[color-mix(in_oklab,var(--vx-accent)_45%,transparent)] bg-[color-mix(in_oklab,var(--vx-accent)_12%,transparent)] px-4 py-3 text-sm font-semibold text-[var(--vx-accent)] hover:bg-[color-mix(in_oklab,var(--vx-accent)_18%,transparent)] disabled:opacity-50"
          >
            {busy === "sandbox" ? <Loader2 className="w-4 h-4 animate-spin" /> : <FlaskConical className="w-4 h-4" />}
            Launch Isolated Investor Sandbox
          </button>
          <p className="text-[10px] text-center text-[var(--vx-text-muted)] vx-mono">
            1-click · provisions investor-&lt;uuid&gt; · private tenant ID · no password needed
          </p>

          <div className="relative flex items-center gap-3 py-1">
            <div className="flex-1 h-px bg-[var(--vx-border)]" />
            <span className="text-[10px] uppercase tracking-wider text-[var(--vx-text-muted)]">or use an account</span>
            <div className="flex-1 h-px bg-[var(--vx-border)]" />
          </div>

          <div className="flex rounded-lg border border-[var(--vx-border)] overflow-hidden text-xs">
            <button type="button" onClick={() => setMode("signin")} className={`flex-1 py-2 flex items-center justify-center gap-1.5 ${mode === "signin" ? "bg-[var(--vx-panel-2)] text-[var(--vx-accent)]" : "text-[var(--vx-text-muted)]"}`}>
              <KeyRound className="w-3.5 h-3.5" /> Sign In
            </button>
            <button type="button" onClick={() => setMode("signup")} className={`flex-1 py-2 flex items-center justify-center gap-1.5 ${mode === "signup" ? "bg-[var(--vx-panel-2)] text-[var(--vx-accent)]" : "text-[var(--vx-text-muted)]"}`}>
              <UserPlus className="w-3.5 h-3.5" /> Sign Up
            </button>
          </div>

          {mode === "signup" && (
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Display name (optional)"
              className="w-full rounded-lg border border-[var(--vx-border)] bg-[var(--vx-bg)] px-3 py-2 text-sm outline-none focus:border-[color-mix(in_oklab,var(--vx-accent)_50%,transparent)]"
            />
          )}
          <input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            className="w-full rounded-lg border border-[var(--vx-border)] bg-[var(--vx-bg)] px-3 py-2 text-sm outline-none focus:border-[color-mix(in_oklab,var(--vx-accent)_50%,transparent)]"
          />
          <input
            type="password"
            autoComplete={mode === "signin" ? "current-password" : "new-password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={mode === "signin" ? "Password" : "Password (8+ characters)"}
            className="w-full rounded-lg border border-[var(--vx-border)] bg-[var(--vx-bg)] px-3 py-2 text-sm outline-none focus:border-[color-mix(in_oklab,var(--vx-accent)_50%,transparent)]"
            onKeyDown={(e) => { if (e.key === "Enter") void submit(); }}
          />

          {error && (
            <div role="alert" className="text-xs text-[var(--sev-high)] bg-[color-mix(in_oklab,var(--sev-high)_8%,transparent)] border border-[color-mix(in_oklab,var(--sev-high)_30%,transparent)] rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          <button
            type="button"
            onClick={() => void submit()}
            disabled={busy !== null || !email || password.length < (mode === "signup" ? 8 : 1)}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--vx-accent)] text-[var(--vx-bg)] px-4 py-2.5 text-sm font-semibold hover:opacity-90 disabled:opacity-50"
          >
            {busy === "auth" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
            {mode === "signin" ? "Sign In" : "Create Account"}
          </button>
        </div>
      </div>
    </div>
  );
}
