# Calendar delivery

> **Read when:** changing shoot assignments, shoot dates/statuses, Google Calendar OAuth, ICS email delivery, or calendar reconciliation.

Calendar delivery is a durable producer/worker flow. Producers record the desired delivery route and enqueue a job; `@repo/calendar-worker` keeps the existing claim, retry, backoff, and stale-lock recovery behavior.

## Routing contract

For each active shoot assignment:

1. A crew user with an active Google Calendar connection and refresh token uses `google`.
2. Otherwise, any crew profile with an email uses `ics`, including registered crew users without Google connected.
3. Otherwise, the mapping is stored as `unsendable` with an actionable reason and no worker job.

`shoot_calendar_events` is the organization-scoped current intent pointer. Every material shoot, route, recipient, terminal, assignment, or deletion change advances `intent_generation`. `calendar_delivery_intents` retains the immutable target/content snapshot for each generation, and each `calendar_sync_jobs` row points at that intent with the same generation and its own snapshot.

`calendar_sync_jobs.delivery_key` includes the operation and generation. Producers may supersede pending/failed work, but never mutate processing work. A lease has a per-claim token; worker completion/failure writes compare job id, generation, processing state, and token. Route replacement writes a cancellation snapshot for the previously delivered recipient/event and a delivery snapshot for the new target. Cancellation revalidates the current generation before calling a provider, so old unassign/reopen work becomes a no-op.

Producer job insertion runs in a savepoint after the mapping is written. A job failure therefore leaves the mapping in `error` with `last_error` instead of silently losing the delivery request. Assignment creation and cancellation intent are committed with their assignment/shoot mutation.

Repeated producer calls with an identical snapshot are idempotent. A changed intent creates a new generation and preserves old attempts, backoff, and leases as immutable history. ICS update selection uses durable delivered history rather than transient `sync_status`, so a failed update retries as an update. Crew deletion and cancellation use the captured recipient/event identity, not current mutable crew data.

The worker uses the immutable intent snapshot for provider target, event payload, and ICS recipient. Invite/update work is revalidated against the active generation; cancellation may run after unassignment or crew soft deletion only when its generation remains current. Cross-organization targets fail without reading or writing the other tenant's data.

## Reconciliation

Report candidates without changing data:

```bash
pnpm calendar:reconcile
pnpm calendar:reconcile --organization-id <organization-id>
```

Repair candidates for one organization:

```bash
pnpm calendar:reconcile --organization-id <organization-id> --apply
```

`--apply` requires a non-blank `--organization-id`; it can never become an accidental global mutation. The command repairs active assignments with absent/stale mapping or job state and mapping-only terminal/deleted/unassigned targets requiring cancellation. It is idempotent and safe to invoke concurrently.

The command prints JSON and exits non-zero when any candidate fails. Operators should inspect `shoot_calendar_events.last_error`, correct invalid crew/contact/integration data, and rerun reconciliation.

## Migration and rollback

Migration `0041_calendar_delivery_identity.sql` adds enum values, generation columns, immutable `calendar_delivery_intents`, job intent/generation/claim-token columns, and the partial job key. Apply it before deploying producers/workers that use intent snapshots.

This hand-authored migration intentionally has no `0041_snapshot.json`. After stacking payment `0039` and Submission `0040`, generate the Drizzle metadata snapshot from this exact SQL/schema state and record the resulting `0041_calendar_delivery_identity` entry in `_journal.json`; do not invent a snapshot against an incomplete base.

Rollback the application before the schema. PostgreSQL enum values are intentionally retained on rollback; drop only the partial index and `delivery_key` column after confirming no deployed producer depends on them.
