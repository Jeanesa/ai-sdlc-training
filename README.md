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

## Architecture Decisions

See `knowledge/ARCH-LMS-MC-v1.0.md` for full ADR documentation.
