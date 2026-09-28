// Findings vault — scans tool output for sensitive artifacts (keys, tokens, PII).
// Scans tool output (or any text) for sensitive artifacts: leaked API keys,
// tokens, credentials, PII, exposed files, and API endpoints. De-duplicates by
// a stable fingerprint and renders masked by default.

import { createHash } from "crypto";
import type { Finding, FindingCategory, Severity } from "./types";

interface CategoryMeta {
  label: string;
  icon: string;
  severity: Severity;
}

// Order controls display order.
export const CATEGORIES: Record<FindingCategory, CategoryMeta> = {
  credentials: { label: "Credentials & Private Keys", icon: "🔐", severity: "critical" },
  api_keys: { label: "API Keys & Secrets", icon: "🔑", severity: "high" },
  tokens: { label: "Tokens & Sessions", icon: "🎫", severity: "high" },
  pii: { label: "User IDs & PII", icon: "👤", severity: "medium" },
  exposed: { label: "Exposed Files & Paths", icon: "📁", severity: "high" },
  endpoints: { label: "Endpoints & URLs", icon: "🌐", severity: "low" },
};

export const SEVERITY_RANK: Record<Severity, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
  info: 4,
};

interface Pattern {
  category: FindingCategory;
  type: string;
  regex: RegExp;
  group: number; // capture group index, 0 = whole match
}

const RAW_PATTERNS: Pattern[] = [
  // credentials
  { category: "credentials", type: "Private key block", regex: /-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP )?PRIVATE KEY-----/, group: 0 },
  { category: "credentials", type: "Password assignment", regex: /(?:passwd|password|pwd)['"]?\s*[:=]\s*['"]([^'"\s]{4,64})['"]/i, group: 1 },
  { category: "credentials", type: "Basic-auth in URL", regex: /https?:\/\/[^/\s:@]+:([^/\s:@]{3,})@[A-Za-z0-9.\-]+/, group: 1 },

  // api_keys
  { category: "api_keys", type: "AWS access key id", regex: /AKIA[0-9A-Z]{16}/, group: 0 },
  { category: "api_keys", type: "AWS secret access key", regex: /aws.{0,20}?(?:secret|key).{0,20}?['"]([0-9a-zA-Z/+]{40})['"]/i, group: 1 },
  { category: "api_keys", type: "Google API key", regex: /AIza[0-9A-Za-z\-_]{35}/, group: 0 },
  { category: "api_keys", type: "Firebase cloud-messaging key", regex: /AAAA[A-Za-z0-9_-]{7}:[A-Za-z0-9_-]{140}/, group: 0 },
  { category: "api_keys", type: "Stripe live secret key", regex: /sk_live_[0-9a-zA-Z]{24}/, group: 0 },
  { category: "api_keys", type: "Stripe publishable key", regex: /pk_live_[0-9a-zA-Z]{24}/, group: 0 },
  { category: "api_keys", type: "Twilio account SID", regex: /AC[0-9a-fA-F]{32}/, group: 0 },
  { category: "api_keys", type: "SendGrid/Mailgun key", regex: /SG\.[0-9A-Za-z_-]{22}\.[0-9A-Za-z_-]{43}/, group: 0 },
  { category: "api_keys", type: "Generic API key/secret", regex: /(?:api[_-]?key|apikey|access[_-]?key|client[_-]?secret|secret)['"]?\s*[:=]\s*['"]([^'"\s]{8,64})['"]/i, group: 1 },

  // tokens
  { category: "tokens", type: "JWT / Bearer token", regex: /eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/, group: 0 },
  { category: "tokens", type: "GitHub token", regex: /gh[pousr]_[0-9A-Za-z]{36,}/, group: 0 },
  { category: "tokens", type: "Slack token", regex: /xox[baprs]-[0-9A-Za-z-]{10,}/, group: 0 },
  { category: "tokens", type: "Google OAuth client id", regex: /[0-9]+-[0-9A-Za-z_]{32}\.apps\.googleusercontent\.com/, group: 0 },
  { category: "tokens", type: "Session/access token assignment", regex: /(?:session|access|auth|refresh)[_-]?token['"]?\s*[:=]\s*['"]([^'"\s]{8,})['"]/i, group: 1 },

  // pii
  { category: "pii", type: "Email address", regex: /[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}/, group: 0 },
  { category: "pii", type: "User/account id", regex: /(?:user|account|customer|member)[_-]?id['"]?\s*[:=]\s*['"]?([0-9A-Za-z\-]{3,40})/i, group: 1 },

  // exposed files / paths
  {
    category: "exposed",
    type: "Exposed sensitive file",
    regex: /\b((?:\/[^\s"'<>]*)?(?:\.env|\.git\/|\.htpasswd|\.aws\/credentials|id_rsa|wp-config\.php|config\.php|phpinfo\.php|\.DS_Store|backup\.(?:sql|zip|tar\.gz)))\b/i,
    group: 1,
  },

  // endpoints
  { category: "endpoints", type: "API endpoint", regex: /["'`](\/(?:api|v[0-9]|rest|graphql|internal|admin|auth|oauth|user|users|account)[^\s"'`<>]*)/, group: 1 },
];

const URL_ON_LINE = /https?:\/\/[A-Za-z0-9.\-]+(?:\/[^\s"'`<>()]*)?/;

const NOISE = /^(?:x{4,}|\*{3,}|redacted|example|changeme|your[_-]?\w+|<[^>]+>|null|none|true|false)$/i;

// A bare IPv4 is recon output, never a secret.
const IPV4 = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/;

function mask(value: string, category: FindingCategory): string {
  if (category === "endpoints" || category === "exposed" || category === "pii") {
    return value.length <= 80 ? value : value.slice(0, 77) + "…";
  }
  const v = value.trim();
  if (v.length <= 8) {
    return v.length > 1 ? v[0] + "•".repeat(v.length - 1) : "•";
  }
  return `${v.slice(0, 4)}${"•".repeat(Math.min(v.length - 8, 12))}${v.slice(-4)}`;
}

function fingerprint(category: string, type: string, value: string, location: string): string {
  return createHash("sha1")
    .update(`${category}|${type}|${value}|${location}`)
    .digest("hex")
    .slice(0, 12);
}

function locationFor(line: string, fallback: string): string {
  const m = line.match(URL_ON_LINE);
  return m ? m[0] : fallback;
}

export function scanFindings(
  text: string,
  opts: { location?: string; sourceTool?: string } = {},
): Finding[] {
  if (!text) return [];
  const fallback = (opts.location || "").trim() || opts.sourceTool || "unknown";
  const out: Finding[] = [];
  for (const line of text.split("\n")) {
    if (!line.trim()) continue;
    for (const p of RAW_PATTERNS) {
      for (const m of line.matchAll(new RegExp(p.regex.source, p.regex.flags.includes("g") ? p.regex.flags : p.regex.flags + "g"))) {
        let value: string;
        try {
          value = p.group === 0 ? m[0] : (m[p.group] || m[0]);
        } catch {
          value = m[0];
        }
        if (!value) continue;
        value = value.trim();
        if (value.length < 3 || NOISE.test(value) || IPV4.test(value)) continue;
        const loc = locationFor(line, fallback);
        out.push({
          id: fingerprint(p.category, p.type, value, loc),
          category: p.category,
          type: p.type,
          value,
          masked: mask(value, p.category),
          location: loc,
          sourceTool: opts.sourceTool || "",
          severity: CATEGORIES[p.category].severity,
        });
      }
    }
  }
  return out;
}

export function mergeFindings(existing: Finding[], incoming: Finding[]): { findings: Finding[]; added: number } {
  const seen = new Set(existing.map((f) => f.id));
  let added = 0;
  for (const f of incoming) {
    if (!seen.has(f.id)) {
      seen.add(f.id);
      existing.push(f);
      added++;
    }
  }
  return { findings: existing, added };
}
