# Vexor

Next.js workspace for authorized security reviews, with multi-tenant authentication,
per-user database isolation, saved conversations, findings, reports, provider settings,
and a responsive chat interface.

Live alpha: https://vexoralpha.vercel.app/

## Authentication & tenant isolation

Vexor ships with session/JWT authentication (httpOnly `vexor_session` cookie) and
strict per-user / per-workspace database isolation:

- **Sign Up / Sign In** with email + password for named accounts.
- **Launch Isolated Investor Sandbox** — one-click provisioning of a fresh
  `investor-<uuid>` tenant with its own private workspace ID. Designed for
  YC / a16z Speedrun / Rev1 reviewers so they are never blocked by a login wall.
- Header **workspace badge** shows the active user / tenant, with
  **Switch Account**, **Sign Out**, and **New Isolated Workspace**.
- Every `Conversation`, `Message`, `Finding`, `Exploit`, `ToolCall`, `Setting`,
  and BYOK provider key is scoped to the authenticated `userId` / `workspaceId`.
  User A cannot read, mutate, or delete User B's records.
- API keys entered in Settings are stored only on that tenant's Setting rows
  (never leaked across users). Server env keys remain as a shared fallback for demos.

Set `AUTH_SECRET` (min 16 chars) in the environment — used to sign session tokens.

## Local setup

Use Node.js 20.9 or newer and npm. The npm lockfile is the maintained install source.

```sh
npm ci
cp .env.example .env
```

Set `DATABASE_URL` to your PostgreSQL connection and `DATABASE_URL_UNPOOLED`
to its direct connection. Set `AUTH_SECRET`. Set at least one provider key from
`.env.example`. Keys belong on the server, never in `NEXT_PUBLIC_*` variables.

For a new development database, initialize the schema explicitly:

```sh
npm run db:push
npm run dev
```

Review database changes before applying them to an existing database. Installation
and builds generate Prisma Client but do not modify the database schema.

## Checks and production build

```sh
npm run lint
npm run typecheck
npm run build
npm start
```

The production server uses Node and the standalone output. Production builds
fail on TypeScript errors. No Bun installation is required.

## Browser regression tests

```sh
npx playwright install chromium
npm run test:e2e
```

The suite starts its own local server on port 3001 and runs on desktop and mobile
Chromium. Workspace responses are mocked to check UI behavior deterministically:
connection errors, navigation, failed saves, duplicate sends, draft preservation,
and ID-based message truncation. Settings validation calls the real local route.
These checks do not prove live provider access or PostgreSQL persistence.

## Deployment

Deploy to Vercel with `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `AUTH_SECRET`,
and at least one model-provider key configured. After schema changes, run
`npx prisma db push` (or migrate) against the production database before
or immediately after deploy.

## Architecture notes

- Next.js App Router + Prisma/Postgres
- Agent loop with 16 defensive security tools, gated by authorized target scope
- Per-tenant settings (provider, model, theme, scope, runtime, BYOK keys)
- Playwright desktop/mobile e2e suite

No shared-workspace mode remains: unauthenticated API calls return 401.
