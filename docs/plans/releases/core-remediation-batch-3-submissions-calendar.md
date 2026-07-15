# Core remediation Release Batch 3 — submissions and Calendar

> **Read when:** reviewing, rehearsing, or deploying
> `codex/core-remediation-release-3-submissions-calendar`.

## Scope

This branch builds on Release Batch 2 commit `28764144`. It adds the approved
multi-assignee submission aggregate/reconciliation behavior and durable
Calendar intent/provider-effect behavior, plus:

- `0040_submission_calendar_additive_state.sql`
- SHA-256: `e62798d94efd7cdb0321112b9d1b67c1d3b2cd0479bdc22895c28b734f3ebf6b`

Migration `0040` is one additive release migration generated from the exact
Batch 2 `0039` snapshot. Its snapshot `prevId` is Batch 2 snapshot
`a6bc73d4-687d-4dda-951b-614bb1d690f6`. It adds:

- submission review-claim time and its organization/status index;
- immutable Calendar intents, route-change records, generations, claim tokens,
  provider-effect state, delivered identity, and replacement/cancellation
  state;
- versioned Google connections and organization-scoped active uniqueness;
- a unique active Calendar job delivery key.

The migration does not repair parent task/deliverable states and calls no
provider. It backfills only mechanically safe state:

- an existing in-review submission with `reviewed_by` keeps the earliest
  available historical claim/review time;
- a legacy Calendar mapping already marked `synced` copies its stored provider
  identity into the delivered fields;
- each existing Calendar job receives a unique database-generated legacy key.

## Required order

1. Record the Batch 2 application SHA, backup/snapshot, and exact starting
   ledger: 40 rows; latest migration time `1784134483742`; latest hash
   `12fb5bf3c004a84338de755750c20daea4a52948e44ed0d66b8cd2233f33c42e`;
   ordered digest `6defd8f405654841b7cefad72d5a9791`.
2. Run the read-only exact-ledger/no-partial-state gate:

   ```bash
   PGOPTIONS='-c default_transaction_read_only=on -c statement_timeout=15000' \
     psql "$DATABASE_URL" -X -f \
     packages/database/drizzle/preflight/0040_submission_calendar_additive_state.sql
   ```

3. Apply migration `0040` once from the controlled release runner while the
   Batch 2 application and Calendar worker remain deployed. The database
   default keeps old Calendar job inserts compatible during this window.
4. Verify 41 ledger rows; latest migration time `1784135676915`; latest hash
   `e62798d94efd7cdb0321112b9d1b67c1d3b2cd0479bdc22895c28b734f3ebf6b`;
   ordered digest `5efd64bb2f3ea3c5815606b938351cc5`. Verify the new tables, columns, indexes,
   defaults, and legacy backfill counts.
5. Begin a controlled Calendar cutover:
   - stop all Batch 2 API instances that can create Calendar jobs;
   - let the Batch 2 Calendar worker finish every pending/retryable job;
   - investigate any failed/exhausted or uncertain legacy job from provider
     evidence—never mark it complete merely to pass the gate;
   - stop the Batch 2 Calendar worker;
   - run the cutover gate while old producers remain stopped:

     ```bash
     PGOPTIONS='-c default_transaction_read_only=on -c statement_timeout=15000' \
       psql "$DATABASE_URL" -X -f \
       packages/database/drizzle/preflight/0040_submission_calendar_cutover.sql
     ```

6. Deploy the Batch 3 API/web application with the new Calendar worker still
   paused.
7. For every organization, run and retain the submission report:

   ```bash
   pnpm submissions:reconcile-parent-review --report \
     --organization-id ORGANIZATION_ID
   ```

   Follow `docs/runbooks/submission-parent-review-reconciliation.md`. Repair
   only rows marked repairable, using the exact reviewed report hash and an
   owner/admin actor. Missing, incomplete, or impossible approval timestamps
   stay manual; never replace them with deployment time.
8. For every organization, report and then materialize durable Calendar state
   while the worker remains paused:

   ```bash
   pnpm calendar:reconcile --organization-id ORGANIZATION_ID
   pnpm calendar:reconcile --organization-id ORGANIZATION_ID --apply
   ```

   Investigate every manual-reconciliation result. Repeat unchanged
   reconciliation and verify that job/provider-effect counts do not increase.
9. Start the Batch 3 Calendar worker. Smoke-test both sibling submission
   approval orders and Google/ICS create, update, route change, unassign,
   delete, cancellation, and repeated reconciliation using non-customer
   destinations.
10. Re-run both reports, compare before/after parent status/timestamps and
    Calendar identity/job counts, and observe database errors, lock waits,
    worker leases, and provider IDs before approving production completion.

## Compatibility and roll-forward

- Batch 2 application/worker with Batch 3 schema: supported during migration
  and queue drain. Old inserts receive unique legacy job keys.
- Batch 3 application/worker with Batch 2 schema: not supported. Apply `0040`
  first.
- Batch 3 worker with unfinished legacy Calendar jobs: deliberately blocked by
  the cutover gate because those jobs lack immutable snapshots.

If `0040` succeeds but application cutover has not started, keep or restore the
Batch 2 application/worker on the additive schema. If new intent-backed jobs
have been created, do not reactivate the old worker; stop external effects and
roll forward. Never delete parent history, Calendar intents, delivered
identity, uncertain provider evidence, or enum values as rollback.

## Local proof — 2026-07-15

- Read-only `0040` preflight passed on the exact Batch 2 ledger and failed
  closed after migration.
- Fresh and representative Batch 2-upgraded PostgreSQL 18 databases migrated
  to 41 rows and produced identical normalized schema dumps.
- Legacy rehearsal rows retained submission claim time, ICS delivered identity,
  sequence, error evidence, and unique job identity.
- The actual Batch 2 Drizzle model inserted a Calendar job successfully after
  `0040`, proving old-application/new-schema compatibility.
- The cutover gate passed with a drained queue, rejected an injected unfinished
  legacy job with an organization/type summary, and passed again only after the
  blocker was resolved.
- API: 72 files, 341 tests passed, including 21 submission transition tests,
  four parent reconciliation tests, and six real PostgreSQL Calendar scenarios.
- Scripts: 37 tests passed. Calendar worker: 4 tests passed.
- API, database, scripts, web, Calendar worker, and Google Calendar type-checks
  passed. Drizzle history and no-drift generation passed.

This is local release-construction evidence, not production release approval.
Staging must retain the real report outputs, reviewed decisions, migration and
lock timings, starting/ending ledgers, application SHAs, provider IDs, smoke
results, and before/after counts before production approval.
