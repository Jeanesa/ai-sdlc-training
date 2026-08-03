# Pattern — Verify a Migration in a Throwaway Postgres Container

When a migration cannot be fully verified live (no `supabase` CLI, no `psql`, no DB
password/token in the session), apply it in a throwaway `postgres:16-alpine` container and prove
constraints/indexes behaviorally with rolled-back transactions.  The container runs a compatible PostgreSQL major version, so DDL/constraint/index behavior is faithful to supabase db push(pin thepostgres: tag to your project's Postgres version if you need exactness).

## When to use

- The session has Docker but no `supabase`/`psql`/`SUPABASE_ACCESS_TOKEN`.
- You need constraint/index/FK evidence (PostgREST can't expose CHECKs, UNIQUEs, FKs, or indexes).
- Live API probing is blocked (e.g. `403 permission denied` because tables lack grants).

## Files to load / commands to run

```bash
# 1. throwaway instance (use postgres:16 to match Supabase's engine lineage)
docker run --rm -d --name sb_intro -e POSTGRES_PASSWORD=p -e POSTGRES_DB=lms postgres:16-alpine
for i in $(seq 1 30); do docker exec sb_intro pg_isready -U postgres -d lms >/dev/null 2>&1 && break; sleep 1; done

# 2. copy the migration in (git-bash mangles /abs paths — use MSYS_NO_PATHCONV=1)
export MSYS_NO_PATHCONV=1
docker cp supabase/migrations/20260519000001_initial_schema.sql sb_intro:/mig.sql

# 3. apply + introspect constraints/indexes
docker exec sb_intro psql -U postgres -d lms -f /mig.sql
docker exec sb_intro psql -U postgres -d lms \
  -c "select conrelid::regclass, conname, pg_get_constraintdef(oid) from pg_constraint where connamespace::regnamespace='public'::regnamespace order by 1,2" \
  -c "select indexname, indexdef from pg_indexes where schemaname='public' order by indexname"

# 4. behavioral probes, each in its own transaction (first error aborts the txn, so isolate them)
docker exec sb_intro psql -U postgres -d lms -c "begin; insert into public.profiles (id,email,role) values ('11111111-1111-1111-1111-111111111111','a@x.com','bogus'); rollback;"
#   expect: violates check constraint "profiles_role_check"
#   success-case probes (no FK on a column) prove absence: bogus value INSERT 0 1, then rollback.

# 5. tear down (--rm would also handle it, but be explicit)
docker stop sb_intro
```

## Key gotchas (learned on TASK-008)

- `git-bash` converts `/mig.sql` to `C:/Program Files/Git/mig.sql` — prefix with
  `MSYS_NO_PATHCONV=1` (or double-slash) for any in-container `/path`.
- One `BEGIN ... ROLLBACK` block aborts on the first error and silently skips every later
  probe — run each probe as its own `psql -c` (each is its own transaction).
- Node cannot `readFile` bash's `/tmp` (path mismatch on Windows) — pipe `curl` output
  straight into `node -e` reading stdin, or write files under the session temp dir with a
  Windows-resolvable path.
- On hosted Supabase, migrations applied via `supabase db push` may leave tables **without**
  grants for `anon`/`authenticated`/`service_role` (every call → `403 42501 permission denied`,
  even SELECT). That blocks live API probing and is out of scope for the DDL migration — flag
  it for the RLS/access-control task rather than silently adding grants.

## Seed idempotency (learned on TASK-009)

`supabase db reset` drops and recreates the DB from empty on every run, so running it twice does
NOT exercise `ON CONFLICT DO NOTHING` — both runs start clean. To truly test seed idempotency,
run the seed TWICE against a populated DB (apply migration once, then seed -> seed again) and
confirm the second run raises no duplicate-key errors. The container flow above does exactly this;
`db reset` twice only proves the reset flow is repeatable.

## Cross-reference

- Live-structure evidence without SQL: `GET /rest/v1/` with `Accept: application/openapi+json`
  (service-role key) — tables, columns, types, NOT NULL, and defaults.
- Prompt set that drives this: `knowledge/prompts/dev/migration-task.md`.
