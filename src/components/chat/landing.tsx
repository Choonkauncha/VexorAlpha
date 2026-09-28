"use client";

const CHIPS = [
  {
    icon: "🎯",
    title: "Pentest a target",
    desc: "Full recon → exploit → patch",
    prompt: "Run a full defensive penetration test against this authorized target — enumerate the attack surface, harvest JS bundles, probe every endpoint, and deliver exploit + patch code:\n\nTarget: ",
  },
  {
    icon: "🔍",
    title: "Audit a repository",
    desc: "OWASP Top 10 + hotfixes",
    prompt: "Audit this repository for OWASP Top 10 vulnerabilities and generate hotfix patches:\n\nRepo: ",
  },
  {
    icon: "🧬",
    title: "Scan a code snippet",
    desc: "Injection & memory safety",
    prompt: "Scan the following code for injection, memory-safety, and input-validation flaws, then propose a patch:\n\n",
  },
  {
    icon: "📖",
    title: "Explain a CVE",
    desc: "How it works & how to fix",
    prompt: "Explain CVE-2024-3094 (the xz backdoor): how it works, how to detect it, and how to remediate it.",
  },
  {
    icon: "🎫",
    title: "Inspect a JWT",
    desc: "alg:none, weak secrets, expiry",
    prompt: "Decode and audit this JWT for alg:none, weak secrets, key-confusion, and missing expiry:\n\n",
  },
  {
    icon: "🛡️",
    title: "Audit security headers",
    desc: "HSTS, CSP, cookies, leakage",
    prompt: "Audit the security headers of this authorized target (HSTS, CSP, X-Frame-Options, cookie flags, info leakage):\n\nTarget: ",
  },
];

export function Landing({ onPick }: { onPick: (prompt: string) => void }) {
  return (
    <div className="relative flex-1 flex flex-col items-center justify-center px-4 py-10 overflow-hidden">
      <div className="absolute inset-0 vx-grid-bg pointer-events-none" />
      <div className="relative z-10 w-full max-w-3xl flex flex-col items-center text-center">
        <div className="vx-glow vx-orb-float w-20 h-20 rounded-full flex items-center justify-center text-4xl mb-6 border border-[color-mix(in_oklab,var(--vx-accent)_40%,transparent)] bg-[color-mix(in_oklab,var(--vx-accent)_10%,transparent)] vx-hero-rise">
          🛡️
        </div>
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight vx-hero-rise" style={{ animationDelay: "0.08s" }}>
          <span className="text-[var(--vx-accent)] vx-text-glow">V</span>e
          <span className="text-[var(--vx-accent)] vx-text-glow">x</span>or
        </h1>
        <p className="mt-3 text-[var(--vx-text-muted)] vx-mono text-sm max-w-xl vx-hero-rise" style={{ animationDelay: "0.16s" }}>
          Autonomous offensive-security agent — recon, exploit, and patch in one loop.
        </p>
        <p className="mt-1.5 text-xs text-[var(--vx-text-muted)] vx-mono vx-hero-rise" style={{ animationDelay: "0.24s" }}>
          Paste code, a repo URL, or a CVE id. The agent runs tools, files findings, and ships verifiable hotfixes.
        </p>

        <div className="mt-8 w-full grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {CHIPS.map((c, i) => (
            <button key={c.title} className="vx-chip vx-chip-in" style={{ animationDelay: `${0.3 + i * 0.06}s` }} onClick={() => onPick(c.prompt)}>
              <span className="vx-chip-ic">{c.icon}</span>
              <span className="flex flex-col">
                <span className="vx-chip-t">{c.title}</span>
                <span className="vx-chip-d">{c.desc}</span>
              </span>
            </button>
          ))}
        </div>

        <p className="mt-8 text-[11px] text-[var(--vx-text-muted)] vx-mono vx-hero-rise" style={{ animationDelay: "0.7s" }}>
          ⚠ Only test systems you are authorized to assess. This is a defensive-security tool.
        </p>
      </div>
    </div>
  );
}
