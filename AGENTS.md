# AGENTS.md — Agent Instructions for Meridian LMS

## Commands
- Build: `npm run build`
- Dev: `npm run dev`
- Lint: `npm run lint` (eslint + typecheck)
- Typecheck: `npm run typecheck`
- Test: `npm run test`
- Format: `npm run format:fix`

## Conventions
- App Router with `"use client"` page wrappers
- Screens receive no props except Dashboard (`user`) and RequestDetail (`requestId`)
- All pages use `Layout` component wrapping screen components
- Tailwind v4 — use `@theme` in `globals.css`, no `tailwind.config.ts`
- Mock data in `src/data/mockData.ts` — do not modify without explicit instruction
- Supabase client helpers in `src/lib/supabase/`
- Error handling via `AppError` class in `src/lib/errors.ts`
- Proxy (middleware) lives in `src/proxy.ts` and exports `proxy` function
- Security headers configured in `next.config.ts` via `headers()` function
- All package versions pinned exactly (no ^ or ~ ranges)
- ESLint uses `typescript-eslint` (not eslint-config-next); `tsconfig.json` has `noUncheckedIndexedAccess: true` and `exactOptionalPropertyTypes: true`
- Pages using `useSearchParams()` must be wrapped in `<Suspense>`

- DB functions writing to RLS/grant-restricted tables (triggers, first-login profile creation) must be SECURITY DEFINER, owner postgres, `SET search_path = ''`, fully-qualified objects
- RLS tests assert through per-role anon-key clients, NEVER the service-role client (it bypasses RLS); empty-read cases assert empty data + no error, blocked writes assert error code 42501
- Unit tests colocated as `*.test.{ts,tsx}` (DB-free, `npm run test`); integration tests in `tests/integration/` (`npm run test:integration`, needs the emulator). Vitest, not Jest
- Migrations idempotent: `CREATE OR REPLACE FUNCTION`, `DROP POLICY/TRIGGER IF EXISTS` before CREATE
- New business data stores (tables AND Storage buckets) block hard DELETE for all roles incl. service_role — removal only via soft-delete `deleted_at` (FR-DATA-001/002 retention); auth/session/ephemeral infra exempt