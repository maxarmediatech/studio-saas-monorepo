# Task-driven deliverables release note

> **Read when:** reviewing, rehearsing, or deploying migrations `0046`–`0049`
> and the task-driven deliverables application release.

## Scope

This release separates internal completion from client delivery, adds
crew-owned assignment progress, introduces booking-scoped task–deliverable
links, and makes Convert to Task the explicit assignment-transfer path.
It also repairs two reviewed legacy conversions whose tasks were soft-deleted:
their invisible reference links and conversion markers are removed so the
active deliverables can be converted again. Deliverable status, deleted task
state, and unrelated metadata remain unchanged.

No runtime environment variables, payment behavior, provider callbacks,
Trigger tasks, queues, or schedules change in this release. Do not deploy
Trigger or run provider reconciliation as part of this cutover.

## Frozen migration contract

Expected production start: exact migration `0045` state.

- ledger rows: `46`
- latest migration time: `1784550431955`
- latest hash:
  `ce5f921d6ca7f0aa29fe627853fa15075261fb2ba0f1ec0760eff68b8945c166`
- ordered digest: `6008232e9e0eeb05362ead618f145128`

Approved migration order and SHA-256 hashes:

1. `0046_brief_clint_barton.sql` —
   `9fa1005651360d40dce5333f8af2f220362ee6e7336dfdb59abc5647e3163246`
2. `0047_rapid_vindicator.sql` —
   `14f18269532f91c3f9af456c3bea2ede21364ed6a5e511bd281c0a27e7e54850`
3. `0048_repair_deliverable_task_link_ids.sql` —
   `1a3720d15f43807ee57f0188e225b16b822ea0662ad01b094d1adbab26d77383`
4. `0049_repair_stale_deliverable_task_links.sql` —
   `9f8143074b242b48b5cf4c0034e2d13b8359cc911e416ef278b50c7bda4f7ffe`

Expected cutover state:

- ledger rows: `50`
- latest migration time: `1784752206666`
- latest hash:
  `9f8143074b242b48b5cf4c0034e2d13b8359cc911e416ef278b50c7bda4f7ffe`
- ordered digest: `6b988d4bb573534343a4cf3c5041ac47`

The schema gate test recalculates these values from the checked-in journal and
migration bytes. A migration edit or journal reorder must fail CI rather than
silently making the operator scripts stale.

## Compatibility boundary

The new application requires all four migrations. The old application is
structurally compatible with the migrated schema, but it is not semantically
safe for deliverable approvals: it writes internal approval timestamps into
`deliverables.delivered_at`, while the new application treats that field as
explicit client delivery.

Freeze task and deliverable mutations before the production preflight. Keep
them frozen until the exact new `main` SHA is Current on `app.stuwiz.com` and
the cutover verification passes a second time. If the deploy fails, keep the
freeze and forward-fix; do not resume the previous application workflow against
the migrated data.

## Required production order

1. Record the approved application patch, current `origin/main`, production
   database identity, and a recoverable provider snapshot/backup reference.
2. Announce and begin the task/deliverable mutation freeze.
3. Run the read-only preflight with the controlled production migration
   credential:

   ```bash
   PGOPTIONS='-c default_transaction_read_only=on -c statement_timeout=15000' \
     psql "$DATABASE_URL" -X -f \
     packages/database/drizzle/preflight/0046_task_driven_deliverables.sql
   ```

4. The preflight must identify exactly two approved stale conversions and zero
   unsafe deleted-task references. Stop on any other count, unexpected ledger,
   partial schema, non-approved legacy delivery timestamp, active approved
   deliverable without a timestamp, or unresolved conversion reference. The
   approved repair is limited to the two rows matching the migration's full
   no-assignment/no-submission and reciprocal-metadata predicate.
5. Apply the four pending migrations from the approved release worktree:

   ```bash
   pnpm --filter @repo/database migrate
   ```

6. Run the cutover verification immediately:

   ```bash
   PGOPTIONS='-c default_transaction_read_only=on -c statement_timeout=15000' \
     psql "$DATABASE_URL" -X -f \
     packages/database/drizzle/preflight/0049_task_driven_deliverables_cutover.sql
   ```

7. Merge the accepted production PR. Confirm Vercel marks the exact `main`
   merge SHA Current on `app.stuwiz.com`; a Preview is insufficient.
8. Before ending the mutation freeze, rerun the cutover verification. It must
   still show zero delivery writes, non-reference links, and non-direct tracking
   rows from the old-application window.
9. Run the changed-domain production smoke and inspect browser/runtime errors.
10. End the freeze, merge `main` back into `staging`, and verify the two-dot tree
    delta is empty.

The migration runner applies every pending journal entry. If it stops partway,
retain the exact error and observed ledger, keep the mutation freeze, and use a
reviewed forward repair. Never delete ledger rows, edit an applied migration,
run `db:push`, or drop the new objects as rollback.

## Staging rehearsal required before promotion

Before the final rehearsal, use the guarded pipeline in
`docs/staging-database-refresh.md` to build a sanitized production snapshot.
Review its manifest, take staging applications and workers offline, publish it
only through the environment guard, apply migrations `0046`–`0049`, run the
cutover gate, then bring up the exact candidate deployment. Never copy raw
production data to staging or run the old staging application against the
refreshed `0045` schema.

On the exact `dev.stuwiz.com` staging deployment:

- ordinary links remain informational and do not transfer status or assignees;
- the status-review nudge and linked-task badge show workflow status;
- Convert to Task transfers assignments and preserves `in_progress`/`blocked`;
- required task workflow rolls up to the task-based deliverable;
- approval/completion remains separate from explicit client delivery;
- informational links can be removed and production links remain protected;
- shoot changes do not drive deliverable workflow;
- the two stale converted deliverables have kept their status and can be
  converted again, while their soft-deleted tasks remain deleted;
- all uniquely named fixtures are cleaned and console/runtime errors recorded.

Run both database operator scripts in a disposable `0045` → `0049` rehearsal.
Do not use the live staging application database as a disposable rollback
target.

## Legacy timestamp gate

Migration `0046` converts the legacy `deliverables.delivered_at` value into the
new internal-completion timestamp. It now aborts if any legacy timestamp belongs
to a deliverable whose system workflow is not `approved`; investigate those rows
before retrying the migration.

```sql
SELECT id, organization_id, workflow_status, delivered_at
FROM deliverables
WHERE delivered_at IS NOT NULL
  AND workflow_status <> 'approved';
```

## User-visible change

Internal approval and client delivery are now separate events. Existing
approval timestamps move to `completedAt`; delivered counts restart from
explicit client-delivery actions. Tell studio operators before rollout so the
corrected count is not mistaken for lost deliverables.

Ordinary task links are informational: task and deliverable statuses and
assignees remain independent. Convert to Task is the explicit path that
transfers assignments and enables task-driven production workflow. Shoots do
not drive deliverable status.

## Production smoke and exclusions

Production smoke is read-only by default: existing session, booking detail,
task detail, deliverable detail, linked-workflow rendering, dashboard/count
sanity, browser console, and Vercel runtime logs. Creating or changing a real
production booking, task, assignment, deliverable, or delivery record requires
a designated fixture and separate approval.

Payments, messages, calendar invitations, provider reconciliation, and Trigger
deployment are explicitly excluded.
