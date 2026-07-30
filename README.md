# Meridian Corp — Leave Management System (LMS)

## Tech Stack

- **Framework:** Next.js 16 (App Router) + TypeScript
- **Styling:** Tailwind CSS v4 + CSS `@theme` tokens
- **Database:** Supabase (PostgreSQL)
- **Auth:** Supabase Auth (magic link)
- **Email:** Resend
- **Deployment:** Vercel
- **Testing:** Vitest + Testing Library

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Project Structure

```
src/
  app/          — App Router pages and API routes
  components/   — Shared UI components (Layout, StatusBadge)
  screens/      — Screen-level components by role (auth, employee, manager, hradmin, sysadmin)
  data/         — Mock data (frozen sets for prototype)
  lib/          — Utilities (errors, Supabase clients)
  types.ts      — Shared TypeScript types
supabase/
  migrations/   — SQL migration files (Stage 2)
  config.toml   — Supabase CLI config
```

## Available Scripts

- `npm run dev` — Start development server
- `npm run build` — Production build
- `npm run lint` — Lint + TypeScript check
- `npm run typecheck` — TypeScript check only
- `npm run test` — Run tests (Vitest)

## Environment Variables

Copy `.env.example` to `.env.local` and fill in your Supabase and Resend credentials.

## CI/CD & Rollback

Two GitHub Actions workflows enforce quality and automate deployments:

- **`pr.yml`** — Triggered on every pull request. Runs lint, typecheck, and tests, then validates migrations against the Supabase staging project. The PR fails if any step fails.
- **`deploy.yml`** — Triggered on every merge to `main`. Runs the same validation, then deploys to Vercel production and pushes migrations to the Supabase production project in parallel.

External-service steps (Supabase push, Vercel deploy) are skipped when their required secrets are not yet configured, so workflows can be merged before secrets are set.

### Rollback Procedures

- **App code rollback**: Use the Vercel dashboard to instantly promote a previous deployment to production. This reverts application code with zero downtime.
- **Schema rollback**: Create a new migration file that reverses the change (e.g., `ALTER TABLE ... DROP COLUMN`). Run `supabase db push` to apply it. Never modify or delete a committed migration file.

## Architecture Decisions

See `knowledge/ARCH-LMS-MC-v1.0.md` for full ADR documentation.
