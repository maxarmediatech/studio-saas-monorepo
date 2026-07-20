# Better Auth 1.6 migration

> **Read when:** reviewing, rehearsing, or deploying the Better Auth 1.6
> upgrade and migration `0045_better_auth_two_factor_lockout`.

## Scope

This release upgrades the Web and Auth packages from Better Auth `1.4.7` to
`1.6.23`, the current stable release at review time. It updates changed Better
Auth APIs without changing the session secret, cookie names, session table, or
credential hashes.

Better Auth `1.6.23` requires Drizzle ORM `^0.45.2`, so all workspace Drizzle
consumers move together from `0.45.1` to the current stable `0.45.2`. Runtime
validation uses the repository's Node 22 toolchain; the minimum advertised Node
version is `20.19.0` because upgraded crypto dependencies do not support older
Node 20 releases.

Migration `0045_better_auth_two_factor_lockout.sql` adds the three fields
required by Better Auth 1.6 account lockout:

- `two_factors.verified`, nullable with default `true`;
- `two_factors.failed_verification_count`, nullable with default `0`;
- `two_factors.locked_until`, nullable.

SHA-256: `ce5f921d6ca7f0aa29fe627853fa15075261fb2ba0f1ec0760eff68b8945c166`.

Existing two-factor secrets receive `verified = true`, preserving their prior
usable state. New enrollment and failed-verification state is managed by Better
Auth 1.6.

The old generic member database hook is replaced by Better Auth's supported
organization hooks. Direct member creation and organization-owner creation run
`afterAddMember`; invitation acceptance runs `afterAcceptInvitation`. Both paths
still create or recover the linked crew record and synchronize billing seats.
Session creation and selected organization endpoints retain the idempotent crew
auto-heal path.

The same PR advances the sanitized staging-clone contract through `0045` and
scrubs the Calendar, WhatsApp, financial, and provider fields introduced by
migrations `0038`–`0045`. These tooling changes do not run during application
deployment.

## Required production order

1. Record the application SHA, recoverable database backup/snapshot, and exact
   starting ledger: 45 rows; latest migration time `1784139529495`; latest hash
   `3f799314296b54d07e5b02eedd70172158c2f991e4844d03a333f4eb8d43f063`;
   ordered digest `eebcacc31ed455fc76d53a8113fb29d9`.
2. Run the read-only exact-ledger/no-partial-schema gate and retain its output:

   ```bash
   PGOPTIONS='-c default_transaction_read_only=on -c statement_timeout=15000' \
     psql "$DATABASE_URL" -X -f \
     packages/database/drizzle/preflight/0045_better_auth_two_factor_lockout.sql
   ```

3. Apply migration `0045` once from the controlled release runner:

   ```bash
   pnpm --filter @repo/database migrate
   ```

4. Verify 46 ledger rows; latest migration time `1784550431955`; latest hash
   `ce5f921d6ca7f0aa29fe627853fa15075261fb2ba0f1ec0760eff68b8945c166`;
   ordered digest `6008232e9e0eeb05362ead618f145128`; and the three new
   nullable columns with defaults `true`, `0`, and `NULL`.
5. Deploy the application. Do not rotate `BETTER_AUTH_SECRET` or change auth
   cookie configuration in this release.
6. Smoke-test, in order:
   - an existing signed-in session and a fresh password sign-in;
   - new signup, email verification, sign-out, and sign-in;
   - password reset and magic-link delivery;
   - organization creation and owner crew creation;
   - invitation acceptance, member crew creation, seat count, and role checks;
   - existing 2FA sign-in, new 2FA enrollment, failed-attempt lockout, and
     recovery after the lock expires.
7. Observe auth error rates, invalid/expired sessions, verification failures,
   invitation failures, missing crew links, seat-sync errors, and 2FA lockouts
   before release completion.

## Compatibility and rollback

- Better Auth 1.4 with schema `0045`: supported. The migration is additive and
  existing rows receive safe defaults.
- Better Auth 1.6 with schema `0044`: unsupported for 2FA operations. Apply the
  migration before deploying the new application.
- If migration `0045` succeeds and application deployment fails, restore the
  previous application deployment and leave `0045` applied. Do not drop the
  columns or edit the migration ledger as rollback.
- If the migration fails, retain the database error and transaction state,
  restore service if it was paused, and repair only with a reviewed forward
  migration.

## Staging-clone gate

Before the next production-to-staging refresh, run the clone build, publish,
and verify flow from `docs/staging-database-refresh.md`. Continue only when the
schema contract, critical index/trigger/enum/default checks, outbound-work
checks, and sanitization validations all pass. Never use the application
staging database as a disposable migration rehearsal target.

## Rehearsal evidence — 2026-07-20

- Better Auth `1.6.23` was confirmed as the latest stable npm release.
- Better Auth's Drizzle peer resolved to Drizzle ORM `0.45.2` across the
  workspace under Node `22.21.1`.
- The matching `auth@1.6.23` CLI generated the three nullable lockout fields.
- Auth, Database, API, and Web type-checks passed.
- A production Web build passed against a freshly migrated disposable database.
- The staging administrator hash passed Better Auth `1.6.23`'s real password
  verifier and rejected an incorrect password.
- Schema and staging-clone safeguard tests passed.
- The read-only `0045` preflight passed against the dedicated staging database
  at the exact `0044` ledger.
- A fresh local PostgreSQL database migrated to 46 ledger rows.
- A representative existing 2FA row upgraded with `verified = true`, failed
  count `0`, and no lock timestamp.

This evidence does not authorize production migration. Record the production
backup reference, preflight output, migration duration, exact deploy SHA, and
smoke-test results in the release record.
