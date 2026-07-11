# Core Product Remediation — Final Validation

> **Read when:** reviewing, merging, deploying, or testing `codex/core-product-remediation`.
>
> **Validated:** 2026-07-11 through commit `d50647b7`, plus the documentation reconciliation in the final commit.

## Verdict

**Code and clean-database validation: pass. Production rollout: conditional.**

The branch is internally consistent, applies migrations `0000` through `0051` on a new PostgreSQL database, has no Drizzle schema drift, passes the complete API and worker test suites, passes monorepo type-check, and produces a successful Next.js production build.

Production rollout still requires the data-dependent gates that cannot be proved from a local clean database:

1. Run the financial mismatch report for every production organization before migrations `0038` and `0043` enforce the new relationships.
2. Rehearse migrations on a recent sanitized production-size database, including WhatsApp duplicate preflights in `0046`, the expense backfill in `0047`, and the report-first rollout preflight before enforcement migrations.
3. Resolve or explicitly assign every reported financial mismatch.
4. Run authenticated browser acceptance tests against staging. The local browser smoke tests reached the production server but skipped because the disposable database had no authenticated user or product fixtures.

Do not treat those four rollout gates as optional test debt. They depend on real data and staging identity/provider configuration.

## Implemented product changes

### Payments and financial integrity

- Protected issued/applied payments from unsafe edits and deletion.
- Added required API idempotency for received-payment creation and schedule conversion.
- Serialized payment, receipt, invoice, schedule, and booking transitions with a consistent lock order.
- Added atomic reversal-and-replacement payment corrections with preserved audit history.
- Enforced active receipt/payment and invoice/schedule uniqueness.
- Added database guards against cross-organization, cross-booking, cross-invoice, and cross-schedule financial links.
- Added the organization-scoped mismatch report and conservative `--fix-safe` mode.

### Invoices and document numbers

- Replaced `MAX + 1` allocation with transactional organization/type/scope sequences.
- Serialized invoice creation, line-item mutations, finalization, cancellation, and deletion.
- Kept finalized financial totals immutable.

### Submission review

- Added conditional single-reviewer claims, reviewer-owned decisions, explicit release, stale administrative release, and reassignment.
- Made submission and parent work-state transitions transactional.
- Recorded review activity and emitted notifications only after successful state changes.

### Calendar delivery

- Added durable, versioned delivery intents and immutable target snapshots.
- Routes Google-connected crew to Google; otherwise email-capable crew to ICS; otherwise records an unsendable state.
- Preserves claim ownership, attempts, backoff, stale recovery, cancellation, and provider-effect compensation.
- Added organization-scoped reconciliation for missing/stale delivery state.

### WhatsApp

- Integrated the scoped WhatsApp runtime from `dev`, without merging unrelated dev changes.
- Added retriable webhook processing, account-scoped contact uniqueness, conflict-safe contact/conversation creation, and monotonic delivery transitions.
- Added expiring outbox/media leases and a non-resendable `delivery_unknown` state after uncertain provider acceptance.
- Added durable campaign-recipient and automation run/action ledgers.
- Rechecks opt-out, block, account deletion, and connection state immediately before provider dispatch.
- Preserved hashed verification-token handling and Meta webhook signature validation.
- Removed the competing legacy campaign send engine; immediate and scheduled campaigns now use one recipient-ledger execution path.
- Added autonomous webhook event claims, bounded replay, lease recovery, and a shared API/worker processor.
- Restores an outbox attempt when a lease expires before provider dispatch, so a final unused attempt cannot strand the message.
- Keeps campaigns running while recipients are merely queued; completion is derived from terminal recipient state and enqueue failures remain visible and retryable.
- Enforces account ownership for every contact after a report-first, ambiguity-safe backfill.

### Expenses and billing

- Made `expense_assignments` the allocation ledger and transactionally rebuilds booking expense totals from live assignments.
- Rolls shoot expenses into the shoot's booking; crew-only expenses remain organization overhead.
- Synchronizes provider quantities only for explicitly seat-based catalog prices.
- Added best-effort membership hooks, recorded reconciliation state, normalized owner-role checks, and an idempotent seat-repair command.

### Operations and rollout

- Added recurring Calendar, seat, and report-only financial reconciliation tasks through the existing Trigger.dev runtime.
- Added deterministic financial and WhatsApp migration preflight commands and replaced references to the nonexistent `--fix-approved` workflow.
- Added transactional booking-number allocation, including soft-deleted historical numbers.

## Migration order and rollout notes

| Migration | Purpose | Rollout concern |
|---|---|---|
| `0038` | Active invoice/schedule and receipt/payment uniqueness | Duplicate production history must be classified first. |
| `0039` | Payment idempotency records | Additive. Preserve tombstones with payment history. |
| `0040` | Submission review claims | Additive; existing submitted work remains unclaimed. |
| `0041` | Calendar delivery intents and route-change durability | Start producers before relying on reconciliation/worker state. |
| `0042` | Payment correction links and reversal fields | Additive; old payments remain ordinary history. |
| `0043` | Financial relationship preflights and write guards | Existing invalid links intentionally stop migration. Repair/decide them first. |
| `0044` | Document sequences | Existing visible numbers seed allocation; do not delete issued documents. |
| `0045` | WhatsApp templates/foundation | Additive. |
| `0046` | WhatsApp reliability, campaigns, automations, uniqueness | Duplicate contact/provider identities intentionally stop migration. |
| `0047` | Canonical expense profitability backfill | Compare booking totals before/after on sanitized production data. |
| `0048` | Billing seat reconciliation state | Additive; run reconciliation after deployment. |
| `0049` | WhatsApp webhook replay leases and retry state | Additive; deploy before relying on autonomous replay. |
| `0050` | Booking document sequence support | Additive; seeds from active and soft-deleted booking history. |
| `0051` | WhatsApp contact account ownership | Reports NULL ownership, backfills only unambiguous single-account organizations, and aborts before `NOT NULL` when manual assignment is required. |

The migrations are forward migrations; there is no verified automatic down-migration path. Take a database backup/snapshot before rollout and prefer roll-forward correction. Financial documents, reversals, receipt numbers, and idempotency tombstones must not be removed during rollback handling.

## Final validation evidence

All commands used Node `24.14.0`, pnpm `10.23.0`, and PostgreSQL 17.

| Gate | Result |
|---|---|
| Fresh migrations `0000` → `0051` | Pass; 52 migration records. |
| Drizzle schema generation | Pass; no schema changes. |
| Critical table/index/trigger inspection | Pass; payment, submission, Calendar, WhatsApp, sequence, and four financial guard objects present. |
| Monorepo type-check | Pass; 28/28 tasks with `NODE_OPTIONS=--max-old-space-size=6144`. |
| Full API suite with PostgreSQL gates | Pass; 71 files, 298 tests. |
| WhatsApp worker | Pass; 2 files, 8 tests. |
| Calendar worker | Pass; 4 tests. |
| Financial and Calendar scripts | Pass; 30 tests. |
| Auth seat synchronization | Pass; 3 tests. |
| Web payment idempotency helpers | Pass; 7 tests. |
| WhatsApp migration preflight | Pass on disposable database; zero duplicate identities. |
| Trigger.dev build (`jobs:deploy --dry-run --skip-sync-env-vars`) | Pass; reconciliation and worker tasks bundled. |
| Changed non-generated files — Biome | Pass. |
| `git diff --check` | Pass. |
| Next.js production build | Pass; compilation, TypeScript, and 96 static pages. |
| Operational financial report | Pass on a disposable organization; zero mismatches. |
| Operational Calendar report | Pass on a disposable organization; zero candidates. |
| Operational seat reconciliation | Pass; zero failures. |
| Authenticated Playwright flows | Not proved locally; 3 selected tests skipped without an authenticated seeded session. |
| Production-size sanitized migration rehearsal | Not available locally. Required before rollout. |
| Staging/production mismatch report | Not run; requires real organization IDs and database access. |

Repository-wide `pnpm check` remains red on unchanged starter, marketing, handbook, and `.sisyphus` files: 340 errors, 212 warnings, and 6 informational diagnostics. None of those files are in this remediation diff. Every changed non-generated source/document file passes Biome. Generated Drizzle snapshots and journal formatting remain generator-owned and are excluded by `biome.json`.

## Release-gate defects fixed during final validation

1. Two PostgreSQL integration tests used Vitest's generic five-second timeout and failed only under full-suite database contention. Their isolated production operations completed in roughly 2.2–2.4 seconds. The tests now use a 15-second integration ceiling; the full parallel suite passes and production lock behavior is unchanged.
2. The financial reconciliation tests attempted to create legacy-invalid rows through the new `0043` write guards. Fixtures now bypass triggers only inside transaction-local test setup, accurately modeling corruption predating enforcement. Normal writes and the reconciliation repair itself still run with all guards enabled.
3. The financial and Calendar runbooks included a pnpm `--` separator that the strict CLIs correctly rejected. The documented commands now match the validated invocation.
4. One WhatsApp procedure had a changed-file formatting failure; it is corrected.

## Commands to reproduce

Use an isolated migrated database. Never point the PostgreSQL test variables at production.

```bash
export DATABASE_URL=postgresql:///studio_core_validation
export POSTGRES_CONCURRENCY_DATABASE_URL="$DATABASE_URL"
export POSTGRES_CALENDAR_DATABASE_URL="$DATABASE_URL"
export POSTGRES_RECONCILIATION_DATABASE_URL="$DATABASE_URL"
export BETTER_AUTH_SECRET=test-secret-at-least-32-characters-long
export NEXT_PUBLIC_SITE_URL=http://localhost:3000

pnpm --filter @repo/database exec drizzle-kit migrate --config=drizzle.config.ts
NODE_OPTIONS=--max-old-space-size=6144 pnpm typecheck
pnpm --filter @repo/api test
pnpm --filter @repo/whatsapp-worker test
pnpm --filter @repo/calendar-worker test
pnpm --filter @repo/scripts test
pnpm --filter @repo/auth exec vitest run lib/organization-seat-sync.test.ts
pnpm --filter @repo/web exec vitest run \
  modules/saas/studio/lib/payment-create-request.test.ts \
  modules/saas/studio/lib/payment-submission-key-store.test.ts
NODE_OPTIONS=--max-old-space-size=6144 pnpm build
```

Operational commands:

```bash
pnpm --filter @repo/scripts financial-reconciliation \
  --organization-id <organization-id> --report

pnpm calendar:reconcile --organization-id <organization-id>
pnpm subscriptions:reconcile-seats
pnpm whatsapp:migration-preflight
pnpm financial:migration-preflight
```

Use `--fix-safe` only after reading the report and confirming the record is within the documented safe-fix boundary. Use Calendar `--apply` only with an explicit organization ID.

## Staging acceptance checklist

1. Create one received payment, retry the identical request, and confirm one payment/receipt/activity result.
2. Attempt to edit protected financial fields and confirm the UI explains why they are locked while notes/reference remain editable.
3. Correct an issued payment and verify the old receipt is voided, the replacement receipt is new, and booking/invoice/schedule totals agree.
4. Race two schedule conversions and verify one conversion/payment result.
5. Add/edit/remove invoice line items, finalize the invoice, and confirm later financial edits are blocked.
6. Have two reviewers claim the same submission; verify only one wins. Verify release, stale admin reassignment, decision ownership, and resubmission.
7. Create direct-booking and shoot-linked expenses; verify booking profitability agrees across booking details, dashboard, and reports.
8. Assign crew with Google, email-only, and no usable email; verify Google, ICS, and unsendable routes respectively. Run reconciliation twice and confirm the second run is a no-op.
9. Replay a WhatsApp webhook, force an event failure and verify autonomous recovery, test immediate and scheduled campaigns through the same recipient ledger, test an opt-out immediately before dispatch, and verify uncertain provider acceptance is not resent automatically.
10. Add and remove members on an explicitly seat-based test plan, simulate one provider failure, and verify the reconciliation command repairs the recorded drift.

## Merge and deployment handoff

- Branch: `codex/core-product-remediation`
- Push status: not pushed
- Final code gate: pass
- Merge recommendation: approve after reviewing the final release-gate commit
- Deployment recommendation: hold until the four production rollout conditions in the verdict are completed
