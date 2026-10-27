# Vexor

Next.js security engineering workspace for authorized security assessments, featuring multi-tenant authentication, per-workspace database isolation, findings management, exploit verification tracking, and an interactive reconnaissance and code-audit console.

**Live Application:** [https://vexoralpha.vercel.app](https://vexoralpha.vercel.app/)

## Key Capabilities

- **Multi-Tenant Authentication & Isolation:** Session authentication (`httpOnly` HMAC-signed `vexor_session` cookie) with strict per-user and per-workspace PostgreSQL isolation across `Conversation`, `Message`, `Finding`, `Exploit`, `ToolCall`, and `Setting` records.
- **One-Click Isolated Sandbox:** Instant provisioning of an isolated `investor-<uuid>` tenant workspace for zero-credential evaluation without a login wall.
- **Security Assessment Engine:** 16 server-side reconnaissance, HTTP/TLS inspection, header/CORS auditing, CVE lookup, and static analysis tools gated by authorized target scope and SSRF protections.
- **Findings Vault & Triage:** Severity timeline, duplicate detection, false-positive marking, bulk triage, and structured Markdown/JSON report exports.
- **Multi-Provider Runtime & BYOK:** Server-side model routing with automatic fallback chains and optional per-tenant Bring-Your-Own-Key (BYOK) configuration isolated to the active workspace.

## Getting Started

Requires Node.js 20.9+ and npm.

```sh
npm ci
cp .env.example .env
```

Configure the required environment variables in `.env`:

- `DATABASE_URL` — Pooled PostgreSQL connection string
- `DATABASE_URL_UNPOOLED` — Direct PostgreSQL connection string (used by Prisma schema operations)
- `AUTH_SECRET` — Secret used to sign session tokens (minimum 16 characters)
- At least one LLM provider key from `.env.example` (`GOOGLE_API_KEY`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, or `OPENROUTER_API_KEY`)

Initialize the development database schema and start the local server:

```sh
npm run db:push
npm run dev
```

## Verification & Production Build

```sh
npm run lint
npm run typecheck
npm test
npm run build
npm start
```

End-to-end Playwright suite (desktop and mobile Chromium):

```sh
npx playwright install chromium
npm run test:e2e
```

## Deployment

Deploy to Vercel with `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `AUTH_SECRET`, and at least one model provider key configured in the project environment.
