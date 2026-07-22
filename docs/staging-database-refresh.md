---
read_when:
  - Refreshing staging from production-shaped data
  - Changing database fields that can contain customer data or credentials
---

# Sanitized staging database refresh

Staging uses the existing remote PostgreSQL database. Local development uses local
PostgreSQL. The refresh is an on-demand pipeline owned by `main`; it is not a
long-lived Git branch or continuous database replica.

## Staging database layout

Staging has its own PlanetScale database, separate from production. It uses that
database's normal `/postgres` logical database; no second logical database or
long-lived PlanetScale branch is required. The sanitized snapshot mirrors the
production schema and useful data shape without retaining production customer
data or credentials.

Use two credentials for this database:

- The refresh credential inherits the database-owner role and is used only by
  the guarded publish command. Never deploy it with the application.
- The staging application credential is a separate limited role used by the web
  app and workers after the refresh has been verified.

Keeping staging in a separate PlanetScale database makes its lifecycle and cost
explicit and prevents an ownership problem in an old development database from
blocking refreshes. Delete superseded PlanetScale databases or branches only
after the new staging application has passed smoke tests and their rollback
window has closed.

## Commands

The commands read credentials from the current process only. They do not load or
modify `.env.local`. PlanetScale URLs using pooled port `6432` are switched to
the direct PostgreSQL port `5432` in memory because dump and restore require a
session-capable direct connection.

`PRODUCTION_DATABASE_URL` must use a dedicated role with `SELECT` access and no
`INSERT`, `UPDATE`, `DELETE`, or `TRUNCATE` privilege on public tables. The build
checks those privileges before copying anything and refuses a normal writable
application credential.

Initialize the existing staging database once, after visually confirming its
PlanetScale branch and direct connection details:

`STAGING_DATABASE_URL` must use the staging branch's default/schema-owner role
(or a staging-only role with PlanetScale's `postgres` permission). An ordinary
application role cannot replace schemas it does not own.

```bash
PRODUCTION_DATABASE_URL="..." \
STAGING_DATABASE_URL="..." \
STAGING_RESET_CONFIRM="staging-host/database-name" \
STAGING_GUARD_TOKEN="a-separate-32-character-random-value" \
pnpm db:staging:init-guard
```

This stores only a SHA-256 hash in `stuwiz_ops.environment_guard`. The schema is
excluded from snapshots and preserved across refreshes. Production must never be
initialized with this guard. On PlanetScale, the confirmation identity includes
the branch-routing ID from the username because branches share regional hosts;
the role name and password are excluded.

```bash
PRODUCTION_DATABASE_URL="..." \
SANITIZATION_KEY="at-least-32-random-characters" \
STAGING_ADMIN_EMAIL="staging-admin@example.com" \
STAGING_ADMIN_PASSWORD="a-new-staging-only-password" \
pnpm db:staging:build
```

`build` streams production through `pg_dump` and `pg_restore` into a temporary
local database, checks it against the latest Drizzle snapshot, sanitizes it in
one transaction, creates one staging-only administrator login, validates it, and
writes:

```text
~/.local/share/stuwiz/staging-snapshots/staging-sanitized.dump
~/.local/share/stuwiz/staging-snapshots/staging-sanitized.dump.manifest.json
```

The temporary local database is removed even when the build fails. Set
`KEEP_SANITIZED_LOCAL_DB=1` only when debugging sanitized output; it never keeps
the pre-sanitization state. Set `PG_BIN_DIR` when PostgreSQL 18 tools are not in a
standard Homebrew location.

The sanitizer is pinned to an explicitly reviewed Drizzle snapshot. A new
migration makes the build fail until its new or changed fields are classified,
sanitized where necessary, and the reviewed snapshot tag is deliberately
advanced. This prevents a future token, message, or customer field from silently
passing through because the schema changed.

Publish only after reviewing the manifest and taking staging applications and
workers offline:

```bash
PRODUCTION_DATABASE_URL="..." \
STAGING_DATABASE_URL="..." \
STAGING_RESET_CONFIRM="staging-host/database-name" \
STAGING_GUARD_TOKEN="the-same-staging-guard-value" \
pnpm db:staging:publish
```

The confirmation value is printed by a rejected publish attempt if it is wrong.
Publish also refuses a database without the staging-only guard. Publishing first
writes a mode-`0600` rollback archive beside the sanitized archive. If restore or
verification fails, the previous staging snapshot is restored automatically.
Keep that rollback archive only until the refreshed staging environment is
accepted, then remove it with `trash`; it can contain data from the previous
staging database.

Run verification independently with:

```bash
PRODUCTION_DATABASE_URL="..." \
STAGING_DATABASE_URL="..." \
pnpm db:staging:verify
```

## Preserved and removed data

Business rows, IDs, relationships, dates, statuses, quantities, and financial
amounts are preserved. Task metadata keeps only `convertedFromDeliverableId`;
deliverable metadata keeps only `convertedToTaskId` and `convertedAt`. These
structural markers let staging rehearse conversion migrations without retaining
the copied task or deliverable name. Names, email addresses, phone numbers,
addresses, free text, URLs, provider identifiers, webhook payloads, and other
integration metadata are replaced deterministically.

Sessions, verification codes, and two-factor secrets are removed. Production
OAuth, WhatsApp, and password credentials are cleared. One existing owner is
assigned the supplied staging-only email and a newly generated Better Auth
password hash. Pending SMS, WhatsApp, calendar, campaign, and account work is
made non-runnable.

The result preserves useful production distributions, not identical storage
bytes. Clearing authentication data and changing string lengths intentionally
changes physical database size.

## Release use

1. Refresh sanitized production-shaped data while `main` is deployed.
2. Verify `main` against staging.
3. Deploy candidate code to staging.
4. Apply candidate migrations in their documented batches.
5. Run product smoke tests and reconciliation reports.
6. Deploy the same migration files and code to production only after approval.

Start with manual refreshes. Automation belongs on a protected self-hosted runner
after multiple successful manual runs; do not place production credentials or a
raw production snapshot on a shared CI runner.
