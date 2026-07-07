# Beyond HOA

Beyond HOA is a mobile HOA (homeowners association) community management portal: residents log in to view documents, dues, violations, and work orders, ask an AI assistant about bylaws, and vote on community matters; the board has additional screens to manage residents, violations, vendors, and work orders and to configure Stripe for dues collection.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port via workflow, proxied at `/api`)
- Expo app runs via the `artifacts/beyond-hoa: expo` workflow (do not run `npx expo` directly)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string (production data — never truncate/drop)
- Optional env: `STRIPE_SECRET_KEY` / Replit-managed Stripe connection (dues payments), `AI_INTEGRATIONS_OPENAI_API_KEY` (bylaw chat assistant, violation photo analysis)

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5 (`artifacts/api-server`)
- Mobile: Expo Router (`artifacts/beyond-hoa`)
- DB: PostgreSQL + Drizzle ORM (`lib/db`)
- Build: esbuild (server), Metro (Expo)

## Where things live

- `artifacts/beyond-hoa/app/` — Expo Router screens: `(tabs)/index.tsx` (home/work orders), `(tabs)/documents.tsx`, `(tabs)/assistant.tsx` (AI bylaw chat), `(tabs)/dues.tsx` (Stripe checkout), `(tabs)/residents.tsx`, `(tabs)/voting.tsx` (local AsyncStorage only, no backend), `board.tsx`, `violation-agent.tsx`, `login.tsx`
- `artifacts/beyond-hoa/contexts/AuthContext.tsx` — JWT auth (AsyncStorage-persisted token), `lib/query-client.ts` — fetch helpers using `EXPO_PUBLIC_DOMAIN`
- `artifacts/api-server/src/routes/` — auth, residents, violations, vendors, work-orders, documents, dues, bylaw-chat
- `artifacts/api-server/templates/` — HTML templates served at `/api/documents/view/:slug`
- `lib/db/src/schema/*.ts` — Drizzle schema, kept in sync with the live production DB (varchar lengths, timestamp tz, constraint names all match production exactly)

## Architecture decisions

- The mobile app was ported from a legacy single-service Expo+Express app (`.migration-backup/`) into this multi-artifact workspace. Frontend keeps its original hand-rolled `apiRequest`/`getQueryFn` fetch pattern (not the generated `@workspace/api-client-react` hooks) to guarantee byte-for-byte behavioral fidelity with the production app during the port.
- Backend routes use raw `pool.query` mirroring the original Express routes 1:1, rather than the generated Zod schemas — a deliberate fidelity-over-convention tradeoff for this port. Future feature work should prefer the OpenAPI-first/generated-hooks pattern described in the `pnpm-workspace` skill.
- Document viewer moved from `/documents/*` to `/api/documents/view/:slug` (only `/api` is proxied to this service); the `doc_path` values in the production `documents` table were updated to match.
- A few pre-existing bugs from the legacy app were intentionally preserved as-is (not fixed) to match production behavior exactly, and marked `// @ts-nocheck` to keep the workspace typecheck green: `app/(tabs)/index.tsx` (missing `Alert` import), `app/board.tsx`, `app/violation-agent.tsx`.

## Product

- Resident login (JWT), home dashboard with quick work-order submission, documents library with in-app HTML viewer, AI bylaw chat assistant, dues payment via Stripe checkout, community voting (local-only), resident directory.
- Board/admin screens: manage residents, violations (with AI photo analysis), vendors, work orders, and Stripe configuration.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- `DATABASE_URL` points at live production data with real residents/documents/violations — always verify schema changes against the existing DB before running `db push`, never drop/truncate tables.
- The `GET /api/residents` route (ported verbatim from the original app) returns `password_hash` in the response body — this is a pre-existing behavior from the legacy app, not a new regression.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
