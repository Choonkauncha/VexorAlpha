# ZythosV2 / Vexor

Next.js workspace for authorized security reviews, with saved conversations,
findings, reports, provider settings, and a responsive chat interface.

## Local setup

Use Node.js 20.9 or newer and npm. The npm lockfile is the maintained install source.

```sh
npm ci
cp .env.example .env
```

Set `DATABASE_URL` to your PostgreSQL connection and `DATABASE_URL_UNPOOLED`
to its direct connection. Set at least one provider key from `.env.example`.
Keys belong on the server, never in `NEXT_PUBLIC_*` variables.

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

## Deployment boundaries

This repository currently has a shared workspace with no user authentication or
per-user record ownership. Use a private, access-controlled deployment; do not
expose its API as a public multi-user service. Target scope is not authentication.
Live provider, persistence, and concurrent-run behavior need verification in the
configured environment before production rollout.

## Debug and polish changes

- Fixed all baseline TypeScript errors and restored build-time checking.
- Unified navigation from the sidebar, footer, and command palette.
- Made mobile panels scroll correctly and use dynamic viewport height.
- Added visible keyboard focus, reduced-motion support, and IME-safe input.
- Kept API error responses out of application state and surfaced failed saves.
- Preserved failed-send drafts and locked submission before async creation.
- Replaced per-message deletion loops with one transactional transcript endpoint.
- Message edits/retries use persisted IDs; clear preserves saved findings.
- Cancelled stale searches, guarded conversation loading, and reset edit state.
- Unified toast rendering and fixed theme synchronization.

No database schema change is required for this patch.
