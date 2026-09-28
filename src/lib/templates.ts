// Conversation prompt templates — pre-fill new chats with a structured prompt.
// These give users a head-start on common audit types.

export interface PromptTemplate {
  id: string;
  icon: string;
  title: string;
  description: string;
  category: "web" | "code" | "crypto" | "recon";
  prompt: string;
}

export const TEMPLATES: PromptTemplate[] = [
  {
    id: "blank",
    icon: "📄",
    title: "Blank",
    description: "Start from scratch",
    category: "recon",
    prompt: "",
  },
  {
    id: "web-pentest",
    icon: "🎯",
    title: "Web Pentest",
    description: "Full recon → exploit → patch on a live target",
    category: "web",
    prompt: `Run a full defensive penetration test against this authorized target.

Methodology:
1. Recon: DNS, TLS, fingerprint the tech stack
2. Enumerate: discover paths, harvest JS bundles for leaked secrets
3. Test: security headers, CORS, injection points, auth bypass
4. Catalog: file each confirmed vulnerability with exploit + patch code
5. Report: structured summary ranked by severity

Target: `,
  },
  {
    id: "code-audit",
    icon: "🔍",
    title: "Code Audit",
    description: "OWASP Top 10 audit of pasted code",
    category: "code",
    prompt: `Audit the following code for OWASP Top 10 vulnerabilities and generate hotfix patches.

For each vulnerability found:
- Identify the vulnerability type (e.g. SQLi, XSS, SSRF, IDOR)
- Show the exact line(s) affected
- Provide a runnable exploit PoC
- Provide a paste-ready patch

Code:
\`\`\`
`,
  },
  {
    id: "jwt-audit",
    icon: "🎫",
    title: "JWT Audit",
    description: "Decode + audit a JWT for security issues",
    category: "crypto",
    prompt: `Decode and audit this JWT for security issues:
- alg:none forgery
- Weak HMAC secret (brute-forceable)
- Key-confusion attacks (RS256 → HS256)
- Missing expiry (exp claim)
- Privileged claims (admin, role)

JWT: `,
  },
  {
    id: "header-audit",
    icon: "🛡️",
    title: "Header Audit",
    description: "Audit security headers (HSTS, CSP, cookies)",
    category: "web",
    prompt: `Audit the security headers of this authorized target:
- HSTS (Strict-Transport-Security)
- Content-Security-Policy
- X-Frame-Options (clickjacking)
- X-Content-Type-Options (MIME sniffing)
- Referrer-Policy
- Cookie flags (Secure, HttpOnly, SameSite)
- Information leakage (Server, X-Powered-By)

Target: `,
  },
  {
    id: "cve-explain",
    icon: "📖",
    title: "Explain CVE",
    description: "Explain a CVE: how it works + how to fix",
    category: "recon",
    prompt: `Explain this CVE in detail:
- What the vulnerability is
- How it works technically
- Affected versions
- How to detect if you're vulnerable
- How to remediate / patch

CVE ID: `,
  },
  {
    id: "secret-scan",
    icon: "🔑",
    title: "Secret Scan",
    description: "Scan pasted text for leaked secrets",
    category: "recon",
    prompt: `Scan the following text for leaked secrets, credentials, and sensitive artifacts:
- AWS / Google / Stripe API keys
- JWTs and bearer tokens
- Private keys and passwords
- Internal endpoints and PII

For each finding, classify by severity and explain the risk.

Text to scan:
`,
  },
  {
    id: "ssrf-test",
    icon: "🌐",
    title: "SSRF Test",
    description: "Test an endpoint for SSRF vulnerabilities",
    category: "web",
    prompt: `Test this endpoint for SSRF vulnerabilities:
- Try cloud metadata endpoints (169.254.169.254)
- Try localhost / internal network
- Try file:// scheme
- Try protocol smuggling

Endpoint (with a URL parameter if applicable): `,
  },
];
