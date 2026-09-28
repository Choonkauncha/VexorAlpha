// Security tools — server-side implementations. All tools are read-only and
// defensive. Network tools enforce an authorization-scope gate before running
// against a live host.

import dns from "dns";
import tls from "tls";
import https from "https";
import http from "http";
import { URL } from "url";
import ZAI from "z-ai-web-dev-sdk";
import { scanFindings } from "./findings";
import type { Finding } from "./types";

export interface ToolDef {
  name: string;
  description: string;
  parameters: Record<string, { type: string; description: string; required?: boolean }>;
}

export const TOOL_DEFS: ToolDef[] = [
  {
    name: "dns_lookup",
    description: "Resolve DNS records (A, AAAA, MX, NS, TXT, CNAME) for a host.",
    parameters: { host: { type: "string", description: "Hostname to resolve", required: true } },
  },
  {
    name: "tls_inspect",
    description: "Inspect a host's TLS certificate: validity, issuer, expiry, protocol.",
    parameters: { host: { type: "string", description: "Host (no scheme)", required: true }, port: { type: "number", description: "Port (default 443)" } },
  },
  {
    name: "fingerprint_web_tech",
    description: "Fetch a URL and fingerprint the server, framework, CMS, and JS libraries from headers + HTML.",
    parameters: { url: { type: "string", description: "Target URL", required: true } },
  },
  {
    name: "discover_paths",
    description: "Probe a base URL for common exposed paths (admin panels, .env, .git/config, backups). Read-only HEAD/GET, returns status codes.",
    parameters: { url: { type: "string", description: "Base URL (e.g. https://example.com)", required: true } },
  },
  {
    name: "analyze_js_bundles",
    description: "Fetch the page, extract <script src> bundles, download each, scan for leaked API keys / secrets / hidden endpoints.",
    parameters: { url: { type: "string", description: "Page URL", required: true } },
  },
  {
    name: "http_probe",
    description: "Send a single arbitrary HTTP request and return status, headers, and a body snippet. Use for SQLi/XSS/SSRF/auth-bypass probing.",
    parameters: {
      method: { type: "string", description: "HTTP method (GET, POST, PUT, OPTIONS...)" },
      url: { type: "string", description: "Target URL", required: true },
      headers: { type: "object", description: "Request headers" },
      body: { type: "string", description: "Request body" },
    },
  },
  {
    name: "analyze_security_headers",
    description: "Audit HSTS, CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, cookie flags, and info-leak headers.",
    parameters: { url: { type: "string", description: "Target URL", required: true } },
  },
  {
    name: "test_cors",
    description: "Detect CORS misconfigurations by sending an Origin header and inspecting ACAO/ACAC/ACAH headers.",
    parameters: { url: { type: "string", description: "Target URL", required: true }, origin: { type: "string", description: "Origin to test (default https://evil.example)" } },
  },
  {
    name: "jwt_inspect",
    description: "Decode a JWT and flag alg:none, weak secrets, key-confusion, missing expiry.",
    parameters: { token: { type: "string", description: "JWT", required: true } },
  },
  {
    name: "generate_attack_payloads",
    description: "Return curated payloads for a category: sqli, xss, traversal, ssti, cmdi, ssrf, xxe, ldap.",
    parameters: { category: { type: "string", description: "Payload category", required: true } },
  },
  {
    name: "transform_payload",
    description: "Encode or decode a payload. Actions: base64-encode, base64-decode, url-encode, url-decode, hex-encode, hex-decode, html-encode, html-decode, double-url-encode.",
    parameters: { action: { type: "string", description: "Action", required: true }, value: { type: "string", description: "Value", required: true } },
  },
  {
    name: "identify_hash",
    description: "Recognize the hash algorithm of a value by length and charset.",
    parameters: { value: { type: "string", description: "Hash string", required: true } },
  },
  {
    name: "cve_lookup",
    description: "Look up CVE details via web search.",
    parameters: { id: { type: "string", description: "CVE id (e.g. CVE-2024-3094)", required: true } },
  },
  {
    name: "fetch_webpage",
    description: "Fetch and extract the text content of a web page (advisory, doc).",
    parameters: { url: { type: "string", description: "URL", required: true } },
  },
  {
    name: "catalog_exploit",
    description: "File a CONFIRMED vulnerability into the live Exploit & Patch Catalog.",
    parameters: {
      title: { type: "string", description: "Short title", required: true },
      severity: { type: "string", description: "critical|high|medium|low|info" },
      location: { type: "string", description: "URL / file / endpoint" },
      exploit_instructions: { type: "string", description: "How to reproduce" },
      exploit_code: { type: "string", description: "Runnable PoC" },
      patch_instructions: { type: "string", description: "What to change and why" },
      patch_code: { type: "string", description: "Paste-ready fix" },
      language: { type: "string", description: "Code language for syntax highlighting" },
    },
  },
  {
    name: "final_message",
    description: "Signal that the audit is complete and the final report has been emitted.",
    parameters: {},
  },
];

// ---------------------------------------------------------------------------
// Authorization scope gate
// ---------------------------------------------------------------------------
export function isHostAuthorized(host: string, scope: string): boolean {
  if (!scope.trim()) return false;
  const lower = host.toLowerCase();
  const entries = scope.toLowerCase().split(/[\s,;]+/).filter(Boolean);
  return entries.some((e) => {
    // exact host or domain suffix
    return lower === e || lower.endsWith("." + e) || e === "*";
  });
}

function assertHostAuthorized(host: string, scope: string): void {
  if (!isHostAuthorized(host, scope)) {
    throw new Error(
      `Host "${host}" is not in the authorized scope. Add it to Settings → Target scope (or use "*") before running network tools against it. This is a defensive-security tool — only test systems you own or are explicitly authorized to assess.`,
    );
  }
}

// ---------------------------------------------------------------------------
// HTTP fetch helper (follows redirects, returns headers + body)
// ---------------------------------------------------------------------------
function fetchUrl(url: string, opts: { method?: string; headers?: Record<string, string>; body?: string; timeoutMs?: number } = {}): Promise<{ status: number; headers: Record<string, string | string[] | undefined>; body: string; finalUrl: string }> {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const lib = u.protocol === "https:" ? https : http;
    const req = lib.request(
      {
        method: opts.method || "GET",
        hostname: u.hostname,
        port: u.port || (u.protocol === "https:" ? 443 : 80),
        path: u.pathname + u.search,
        headers: {
          "User-Agent": "Vexor-Audit/1.0 (defensive-security; +https://vexor.local)",
          ...opts.headers,
        },
        timeout: opts.timeoutMs ?? 12000,
      },
      (res) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          let loc = res.headers.location as string;
          if (loc.startsWith("/")) loc = `${u.protocol}//${u.host}${loc}`;
          // follow up to 5 redirects
          if ((opts as any)._depth >= 5) return reject(new Error("Too many redirects"));
          return resolve(fetchUrl(loc, { ...opts, _depth: ((opts as any)._depth || 0) + 1 } as any));
        }
        const chunks: Buffer[] = [];
        res.on("data", (c) => chunks.push(c as Buffer));
        res.on("end", () => {
          resolve({
            status: res.statusCode || 0,
            headers: res.headers as any,
            body: Buffer.concat(chunks).toString("utf8"),
            finalUrl: url,
          });
        });
      },
    );
    req.on("timeout", () => req.destroy(new Error("Request timed out")));
    req.on("error", reject);
    if (opts.body) req.write(opts.body);
    req.end();
  });
}

// ---------------------------------------------------------------------------
// Tool implementations
// ---------------------------------------------------------------------------
async function dnsLookup(args: { host: string }): Promise<string> {
  const host = String(args.host || "").trim();
  if (!host) return "Error: host required";
  const types: (keyof typeof dns.promises)[] = ["resolve4", "resolve6", "resolveMx", "resolveNs", "resolveTxt", "resolveCname"];
  const lines: string[] = [`DNS records for ${host}:`, ""];
  for (const t of types) {
    try {
      const r = await (dns.promises as any)[t](host);
      const flat = Array.isArray(r) ? r.map((x: any) => (Array.isArray(x) ? x.join(" ") : x)).join(", ") : String(r);
      lines.push(`${t.replace("resolve", "").toUpperCase()}: ${flat}`);
    } catch (e: any) {
      if (e.code !== "ENOTFOUND" && e.code !== "ENODATA") lines.push(`${t}: ${e.message}`);
    }
  }
  return lines.join("\n") || `No records found for ${host}`;
}

async function tlsInspect(args: { host: string; port?: number }, scope: string): Promise<string> {
  const host = String(args.host || "").trim().replace(/^https?:\/\//, "");
  const port = Number(args.port || 443);
  if (!host) return "Error: host required";
  assertHostAuthorized(host, scope);
  return new Promise((resolve) => {
    const sock = tls.connect({ host, port, servername: host, rejectUnauthorized: false }, () => {
      const cert = sock.getPeerCertificate();
      const proto = sock.getProtocol();
      const cipher = sock.getCipher();
      const lines: string[] = [`TLS inspection for ${host}:${port}`, ""];
      lines.push(`Protocol: ${proto || "unknown"}`);
      lines.push(`Cipher: ${cipher ? `${cipher.name} (${cipher.version})` : "unknown"}`);
      lines.push(`Authorized: ${sock.authorized ? "valid chain" : "INVALID / self-signed / chain broken"}`);
      if (cert && Object.keys(cert).length) {
        lines.push("");
        lines.push(`Subject: ${cert.subject ? JSON.stringify(cert.subject) : "n/a"}`);
        lines.push(`Issuer: ${cert.issuer ? JSON.stringify(cert.issuer) : "n/a"}`);
        lines.push(`Valid from: ${cert.valid_from}`);
        lines.push(`Valid to:   ${cert.valid_to}`);
        const daysLeft = Math.round((new Date(cert.valid_to).getTime() - Date.now()) / 86400000);
        lines.push(`Days remaining: ${daysLeft}`);
        lines.push(`SAN: ${cert.subjectaltname || "none"}`);
      }
      sock.end();
      resolve(lines.join("\n"));
    });
    sock.setTimeout(10000, () => {
      sock.destroy(new Error("TLS connect timed out"));
    });
    sock.on("error", (e) => resolve(`TLS inspection failed: ${e.message}`));
  });
}

async function fingerprintWebTech(args: { url: string }, scope: string): Promise<string> {
  const url = String(args.url || "").trim();
  if (!url) return "Error: url required";
  assertHostAuthorized(new URL(url).hostname, scope);
  const r = await fetchUrl(url);
  const lines: string[] = [`Fingerprint for ${url}`, "", "HTTP response headers:"];
  for (const [k, v] of Object.entries(r.headers)) lines.push(`  ${k}: ${Array.isArray(v) ? v.join(", ") : v}`);
  lines.push("", "Detected technology:");
  const server = r.headers.server as string | undefined;
  const xpb = r.headers["x-powered-by"] as string | undefined;
  if (server) lines.push(`  Server: ${server}`);
  if (xpb) lines.push(`  Runtime: ${xpb}`);
  const html = r.body;
  const detected: string[] = [];
  if (/wp-content|wp-includes|wordpress/i.test(html)) detected.push("WordPress");
  if (/react|_next\/static|__NEXT_DATA__/i.test(html)) detected.push("Next.js / React");
  if (/vue|__vue__/i.test(html)) detected.push("Vue");
  if (/angular|ng-version/i.test(html)) detected.push("Angular");
  if (/django|csrfmiddlewaretoken/i.test(html)) detected.push("Django");
  if (/laravel|__legacy/i.test(html)) detected.push("Laravel");
  if (/rails|csrf-token" name="csrf-token/i.test(html)) detected.push("Rails");
  if (/cdn-cgi|cloudflare/i.test(html) || r.headers.server === "cloudflare") detected.push("Cloudflare");
  if (/jsdelivr|bootstrap/i.test(html)) detected.push("Bootstrap");
  if (detected.length) lines.push(`  Frameworks: ${detected.join(", ")}`);
  else lines.push("  No well-known framework signatures detected in the HTML.");
  return lines.join("\n");
}

const COMMON_PATHS = [
  "robots.txt", "sitemap.xml", ".env", ".git/config", ".git/HEAD", ".htaccess",
  ".htpasswd", "admin", "admin/login", "administrator", "wp-admin", "wp-login.php",
  "phpinfo.php", "config.php", "backup.sql", "backup.zip", "db.sql",
  "api", "api/v1", "api/v1/users", "graphql", "swagger.json", "swagger-ui",
  "actuator", "actuator/health", "actuator/env", "actuator/heapdump",
  "console", "debug", "debug/pprof", "server-status", ".DS_Store",
  "package.json", "composer.json", "yarn.lock", "node_modules",
];

async function discoverPaths(args: { url: string }, scope: string): Promise<string> {
  const url = String(args.url || "").trim().replace(/\/$/, "");
  if (!url) return "Error: url required";
  assertHostAuthorized(new URL(url).hostname, scope);
  const lines: string[] = [`Path discovery for ${url}`, ""];
  const results: string[] = [];
  // probe in batches of 6
  const batch = [...COMMON_PATHS];
  while (batch.length) {
    const slice = batch.splice(0, 6);
    await Promise.all(
      slice.map(async (p) => {
        try {
          const r = await fetchUrl(`${url}/${p}`, { method: "GET", timeoutMs: 8000 });
          if (r.status !== 0 && r.status < 500 && r.status !== 404) {
            const len = r.body.length;
            results.push(`  ${String(r.status).padEnd(3)} /${p}  (${len} bytes)`);
          }
        } catch {
          /* ignore individual failures */
        }
      }),
    );
  }
  if (!results.length) lines.push("No interesting paths found.");
  else lines.push("Status  Path  (size)", ...results.sort());
  return lines.join("\n");
}

async function analyzeJsBundles(args: { url: string }, scope: string): Promise<string> {
  const url = String(args.url || "").trim();
  if (!url) return "Error: url required";
  assertHostAuthorized(new URL(url).hostname, scope);
  const r = await fetchUrl(url);
  const scriptSrcs = Array.from(r.body.matchAll(/src=["']([^"']+\.js[^"']*)["']/gi)).map((m) => m[1]);
  const unique = Array.from(new Set(scriptSrcs));
  if (!unique.length) return `No external <script src> JS bundles found at ${url}.`;
  const lines: string[] = [`JS bundle scan for ${url}`, `Found ${unique.length} bundle(s):`, ""];
  for (const src of unique.slice(0, 12)) {
    const abs = src.startsWith("http") ? src : new URL(src, url).href;
    try {
      const jr = await fetchUrl(abs, { timeoutMs: 10000 });
      lines.push(`== ${abs}  (${jr.body.length} bytes) ==`);
      const findings = scanFindings(jr.body, { location: abs, sourceTool: "analyze_js_bundles" });
      if (findings.length) {
        lines.push("  Leaked secrets / endpoints:");
        for (const f of findings.slice(0, 20)) lines.push(`    [${f.severity}] ${f.type}: ${f.masked}`);
      } else {
        lines.push("  No leaked secrets detected in this bundle.");
      }
    } catch (e: any) {
      lines.push(`== ${abs} ==  fetch failed: ${e.message}`);
    }
  }
  return lines.join("\n");
}

async function httpProbe(args: { method?: string; url: string; headers?: Record<string, string>; body?: string }, scope: string): Promise<string> {
  const url = String(args.url || "").trim();
  if (!url) return "Error: url required";
  assertHostAuthorized(new URL(url).hostname, scope);
  const method = (args.method || "GET").toUpperCase();
  const r = await fetchUrl(url, { method, headers: args.headers, body: args.body, timeoutMs: 12000 });
  const lines: string[] = [`HTTP ${method} ${url}`, `Status: ${r.status}`, "", "Response headers:"];
  for (const [k, v] of Object.entries(r.headers)) lines.push(`  ${k}: ${Array.isArray(v) ? v.join(", ") : v}`);
  lines.push("", "Body (first 1000 chars):", r.body.slice(0, 1000));
  return lines.join("\n");
}

async function analyzeSecurityHeaders(args: { url: string }, scope: string): Promise<string> {
  const url = String(args.url || "").trim();
  if (!url) return "Error: url required";
  assertHostAuthorized(new URL(url).hostname, scope);
  const r = await fetchUrl(url);
  const h = r.headers;
  const checks: { name: string; present: boolean; value: string; verdict: string }[] = [
    { name: "strict-transport-security", present: !!h["strict-transport-security"], value: String(h["strict-transport-security"] || ""), verdict: h["strict-transport-security"] ? "OK" : "MISSING — HSTS not enforced" },
    { name: "content-security-policy", present: !!h["content-security-policy"], value: String(h["content-security-policy"] || ""), verdict: h["content-security-policy"] ? "OK" : "MISSING — XSS/injection risk" },
    { name: "x-frame-options", present: !!h["x-frame-options"], value: String(h["x-frame-options"] || ""), verdict: h["x-frame-options"] ? "OK" : "MISSING — clickjacking risk" },
    { name: "x-content-type-options", present: !!h["x-content-type-options"], value: String(h["x-content-type-options"] || ""), verdict: h["x-content-type-options"] ? "OK" : "MISSING — MIME sniffing risk" },
    { name: "referrer-policy", present: !!h["referrer-policy"], value: String(h["referrer-policy"] || ""), verdict: h["referrer-policy"] ? "OK" : "MISSING — referrer leakage" },
    { name: "permissions-policy", present: !!h["permissions-policy"], value: String(h["permissions-policy"] || ""), verdict: h["permissions-policy"] ? "OK" : "MISSING — feature policy not set" },
  ];
  const lines: string[] = [`Security header audit for ${url}`, ""];
  for (const c of checks) {
    lines.push(`${c.present ? "✓" : "✗"} ${c.name}`);
    if (c.present) lines.push(`    value: ${c.value}`);
    lines.push(`    ${c.verdict}`);
  }
  const setCookie = h["set-cookie"];
  if (setCookie) {
    lines.push("", "Cookie flags:");
    const cookies = Array.isArray(setCookie) ? setCookie : [setCookie];
    for (const c of cookies) {
      const flags = [];
      if (/secure/i.test(c)) flags.push("Secure");
      if (/httponly/i.test(c)) flags.push("HttpOnly");
      if (/samesite/i.test(c)) flags.push("SameSite");
      lines.push(`  ${c.split(";")[0]} → [${flags.join(", ") || "NO SECURITY FLAGS"}]`);
    }
  }
  const server = h.server as string | undefined;
  const xpb = h["x-powered-by"] as string | undefined;
  if (server || xpb) {
    lines.push("", "Information leakage:");
    if (server) lines.push(`  Server header exposes: ${server}`);
    if (xpb) lines.push(`  X-Powered-By exposes: ${xpb}`);
  }
  return lines.join("\n");
}

async function testCors(args: { url: string; origin?: string }, scope: string): Promise<string> {
  const url = String(args.url || "").trim();
  if (!url) return "Error: url required";
  assertHostAuthorized(new URL(url).hostname, scope);
  const origin = args.origin || "https://evil.example";
  const r = await fetchUrl(url, { method: "GET", headers: { Origin: origin } });
  const acao = r.headers["access-control-allow-origin"] as string | undefined;
  const acac = r.headers["access-control-allow-credentials"] as string | undefined;
  const acah = r.headers["access-control-allow-headers"] as string | undefined;
  const lines: string[] = [`CORS test for ${url}`, `Tested origin: ${origin}`, ""];
  lines.push(`Access-Control-Allow-Origin: ${acao || "(none)"}`);
  lines.push(`Access-Control-Allow-Credentials: ${acac || "(none)"}`);
  lines.push(`Access-Control-Allow-Headers: ${acah || "(none)"}`);
  lines.push("");
  if (acao === "*" && acac === "true") lines.push("⚠ CRITICAL: wildcard origin + credentials — full cross-origin data theft.");
  else if (acao === origin && acac === "true") lines.push("⚠ HIGH: reflects arbitrary origin + credentials — cross-origin data theft.");
  else if (acao === "*") lines.push("Low: wildcard origin without credentials — limited exposure.");
  else if (acao === origin) lines.push("Medium: reflects origin without credentials — verify sensitivity.");
  else lines.push("OK: no permissive CORS detected.");
  return lines.join("\n");
}

function jwtInspect(args: { token: string }): string {
  const token = String(args.token || "").trim();
  if (!token) return "Error: token required";
  const parts = token.split(".");
  if (parts.length < 2) return "Error: not a valid JWT (needs header.payload.signature)";
  const decode = (s: string) => {
    try {
      const norm = s.replace(/-/g, "+").replace(/_/g, "/");
      return JSON.parse(Buffer.from(norm, "base64").toString("utf8"));
    } catch {
      return null;
    }
  };
  const header = decode(parts[0]);
  const payload = decode(parts[1]);
  const lines: string[] = ["JWT inspection", "", "Header:", JSON.stringify(header, null, 2), "", "Payload:", JSON.stringify(payload, null, 2), "", "Findings:"];
  if (header?.alg === "none") lines.push("  ⚠ CRITICAL: alg=none — token can be forged without a signature.");
  if (header?.alg && /HS\d+/.test(header.alg)) lines.push(`  Note: symmetric alg ${header.alg} — brute-forceable if secret is weak.`);
  if (header?.alg && /RS|ES|PS/.test(header.alg)) lines.push(`  Note: asymmetric alg ${header.alg} — verify key-confusion (RS→HS) is not accepted.`);
  if (payload?.exp) {
    const exp = new Date(payload.exp * 1000);
    const expired = exp.getTime() < Date.now();
    lines.push(`  Expires: ${exp.toISOString()} ${expired ? "⚠ EXPIRED" : "(valid)"}`);
  } else {
    lines.push("  ⚠ HIGH: no exp claim — token never expires.");
  }
  if (!payload?.iat) lines.push("  Note: no iat claim.");
  if (payload?.admin || payload?.role === "admin") lines.push("  Note: privileged claim present (admin).");
  return lines.join("\n");
}

const PAYLOADS: Record<string, string[]> = {
  sqli: ["' OR '1'='1' -- -", "admin'-- -", "' UNION SELECT NULL,version(),NULL -- -", "1; DROP TABLE users-- -", "' OR SLEEP(5)-- -", "\") OR (\"1\"=\"1"],
  xss: ["<script>alert(1)</script>", "\"><img src=x onerror=alert(1)>", "javascript:alert(1)", "<svg/onload=alert(1)>", "'-alert(1)-'", "<iframe src=javascript:alert(1)>"],
  traversal: ["../../../etc/passwd", "..\\..\\..\\windows\\win.ini", "....//....//....//etc/passwd", "%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd", "/var/log/../../etc/shadow"],
  ssti: ["{{7*7}}", "${7*7}", "<%=7*7%>", "{{config}}", "{{self.__class__.__mro__[1].__subclasses__()}}", "#{7*7}"],
  cmdi: ["; id", "| id", "`id`", "$(id)", "& id", "; cat /etc/passwd", "&& whoami"],
  ssrf: ["http://169.254.169.254/latest/meta-data/", "http://localhost:8080/admin", "http://[::1]/", "file:///etc/passwd", "gopher://localhost:6379/_INFO"],
  xxe: ["<?xml version=\"1.0\"?><!DOCTYPE foo [<!ENTITY xxe SYSTEM \"file:///etc/passwd\">]><foo>&xxe;</foo>"],
  ldap: ["*)(uid=*))(|(uid=*", "admin)(&(password=*))", "*()|&'", "(cn=*)"],
};

function generateAttackPayloads(args: { category: string }): string {
  const cat = String(args.category || "").toLowerCase();
  const list = PAYLOADS[cat];
  if (!list) return `Unknown category. Available: ${Object.keys(PAYLOADS).join(", ")}`;
  return `Curated ${cat} payloads:\n\n${list.map((p, i) => `${i + 1}. ${p}`).join("\n")}`;
}

function transformPayload(args: { action: string; value: string }): string {
  const action = String(args.action || "").toLowerCase();
  const value = String(args.value || "");
  const map: Record<string, () => string> = {
    "base64-encode": () => Buffer.from(value, "utf8").toString("base64"),
    "base64-decode": () => Buffer.from(value, "base64").toString("utf8"),
    "url-encode": () => encodeURIComponent(value),
    "url-decode": () => decodeURIComponent(value),
    "hex-encode": () => Buffer.from(value, "utf8").toString("hex"),
    "hex-decode": () => Buffer.from(value, "hex").toString("utf8"),
    "html-encode": () => value.replace(/[<>&"']/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&#39;" }[c]!)),
    "html-decode": () => value.replace(/&(lt|gt|amp|quot|#39);/g, (_m, c) => ({ lt: "<", gt: ">", amp: "&", quot: '"', "#39": "'" }[c]!)),
    "double-url-encode": () => encodeURIComponent(encodeURIComponent(value)),
  };
  const fn = map[action];
  if (!fn) return `Unknown action. Available: ${Object.keys(map).join(", ")}`;
  try {
    return fn();
  } catch (e: any) {
    return `Error: ${e.message}`;
  }
}

function identifyHash(args: { value: string }): string {
  const v = String(args.value || "").trim();
  if (!v) return "Error: value required";
  const len = v.length;
  const hex = /^[0-9a-fA-F]+$/.test(v);
  const lines: string[] = [`Hash analysis: ${v}`, `Length: ${len} chars`, `Charset: ${hex ? "hexadecimal" : "mixed"}`, "", "Likely algorithm:"];
  const candidates: { algo: string; test: () => boolean }[] = [
    { algo: "MD5", test: () => len === 32 && hex },
    { algo: "SHA-1", test: () => len === 40 && hex },
    { algo: "SHA-224", test: () => len === 56 && hex },
    { algo: "SHA-256", test: () => len === 64 && hex },
    { algo: "SHA-384", test: () => len === 96 && hex },
    { algo: "SHA-512", test: () => len === 128 && hex },
    { algo: "NTLM", test: () => len === 32 && hex },
    { algo: "bcrypt", test: () => v.startsWith("$2a$") || v.startsWith("$2b$") || v.startsWith("$2y$") },
    { algo: "argon2", test: () => v.startsWith("$argon2") },
    { algo: "scrypt", test: () => v.startsWith("$scrypt$") },
    { algo: "CRC32", test: () => len === 8 && hex },
    { algo: "MySQL 3.x (old)", test: () => len === 16 && hex },
    { algo: "MySQL 5.x (SHA1(SHA1))", test: () => len === 40 && hex },
  ];
  const matches = candidates.filter((c) => c.test()).map((c) => c.algo);
  if (matches.length) lines.push(...matches.map((m) => `  • ${m}`));
  else lines.push("  No standard hash signature matched.");
  return lines.join("\n");
}

async function cveLookup(args: { id: string }): Promise<string> {
  const id = String(args.id || "").trim();
  if (!id) return "Error: id required";
  try {
    const zai = await ZAI.create();
    const res = await zai.functions.invoke("web_search", { query: `${id} CVE CVSS details affected patched`, num: 5 });
    const items = res || [];
    if (!items.length) return `No results found for ${id}.`;
    const lines: string[] = [`CVE lookup: ${id}`, ""];
    for (const it of items) {
      lines.push(`• ${it.name}`);
      lines.push(`  ${it.url}`);
      lines.push(`  ${it.snippet}`);
      lines.push("");
    }
    return lines.join("\n");
  } catch (e: any) {
    return `CVE lookup failed: ${e.message}`;
  }
}

async function fetchWebpage(args: { url: string }): Promise<string> {
  const url = String(args.url || "").trim();
  if (!url) return "Error: url required";
  try {
    const zai = await ZAI.create();
    const res = await zai.functions.invoke("page_reader", { url });
    const data = res?.data;
    if (!data) return `Failed to fetch ${url}.`;
    const lines: string[] = [`Web page: ${data.title || url}`, `URL: ${data.url}`, ""];
    if (data.publishedTime) lines.push(`Published: ${data.publishedTime}`, "");
    // strip HTML tags for a compact text view
    const text = (data.html || "").replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "").replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    lines.push(text.slice(0, 4000));
    return lines.join("\n");
  } catch (e: any) {
    return `Fetch failed: ${e.message}`;
  }
}

// ---------------------------------------------------------------------------
// Dispatcher
// ---------------------------------------------------------------------------
export interface ToolRunResult {
  output: string;
  findings?: Finding[];
  exploitArgs?: Record<string, unknown>;
  isFinal?: boolean;
  isCatalog?: boolean;
}

export async function runTool(
  name: string,
  args: Record<string, unknown>,
  scope: string,
): Promise<ToolRunResult> {
  switch (name) {
    case "dns_lookup":
      return { output: await dnsLookup(args as any) };
    case "tls_inspect":
      return { output: await tlsInspect(args as any, scope) };
    case "fingerprint_web_tech":
      return { output: await fingerprintWebTech(args as any, scope) };
    case "discover_paths":
      return { output: await discoverPaths(args as any, scope) };
    case "analyze_js_bundles": {
      const out = await analyzeJsBundles(args as any, scope);
      return { output: out };
    }
    case "http_probe":
      return { output: await httpProbe(args as any, scope) };
    case "analyze_security_headers":
      return { output: await analyzeSecurityHeaders(args as any, scope) };
    case "test_cors":
      return { output: await testCors(args as any, scope) };
    case "jwt_inspect":
      return { output: jwtInspect(args as any) };
    case "generate_attack_payloads":
      return { output: generateAttackPayloads(args as any) };
    case "transform_payload":
      return { output: transformPayload(args as any) };
    case "identify_hash":
      return { output: identifyHash(args as any) };
    case "cve_lookup":
      return { output: await cveLookup(args as any) };
    case "fetch_webpage":
      return { output: await fetchWebpage(args as any) };
    case "catalog_exploit":
      return { output: `Filed exploit "${args.title}" into the Exploit & Patch Catalog.`, exploitArgs: args, isCatalog: true };
    case "final_message":
      return { output: "Audit complete.", isFinal: true };
    default:
      return { output: `Unknown tool: ${name}` };
  }
}

// Scan a tool's output for sensitive findings (called by the agent loop after
// each tool_output event, auto-scanning for leaked secrets).
export function scanToolOutput(
  toolName: string,
  args: Record<string, unknown>,
  output: string,
): Finding[] {
  const argStr = JSON.stringify(args);
  const loc = String(args.url || args.host || args.target || args.location || "") || argStr;
  return scanFindings(output, { location: loc, sourceTool: toolName });
}
