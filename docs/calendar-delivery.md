# Calendar delivery

> **Read when:** changing shoot assignments, shoot dates/statuses, Google Calendar OAuth, ICS email delivery, or calendar reconciliation.

Calendar delivery is a durable producer/worker flow. Producers record the desired delivery route and enqueue a job; `@repo/calendar-worker` keeps the existing claim, retry, backoff, and stale-lock recovery behavior.

## Routing contract

For each active shoot assignment:

1. A crew user with an active Google Calendar connection and refresh token uses `google`.
2. Otherwise, any crew profile with an email uses `ics`, including registered crew users without Google connected.
3. Otherwise, the mapping is stored as `unsendable` with an actionable reason and no worker job.

`shoot_calendar_events` is the durable assignment-to-delivery mapping. The unique `(organization_id, shoot_id, crew_id)` identity prevents cross-tenant and duplicate mappings. `calendar_sync_jobs.delivery_key` provides a deterministic delivery/cancellation identity, and its partial unique index permits at most one non-completed job for each identity.

Cancellation supersedes a delivery job that has not started. If delivery is already processing, cancellation gets its own deterministic job delayed by one minute, so the worker can finish the in-flight operation before removing the event.

Producer job insertion runs in a savepoint after the mapping is written. A job failure therefore leaves the mapping in `error` with `last_error` instead of silently losing the delivery request. Assignment creation and cancellation intent are committed with their assignment/shoot mutation.

Repeated producer calls preserve an active job's attempts, retry time, and lease. A route change updates the active job type without resetting that lifecycle. Exhausted jobs remain terminal and surface an actionable mapping error; they are not silently revived by reconciliation.

The worker resolves the shoot, booking, crew, assignment, organization time zone, and ICS recipient from current organization-scoped data. Invite/update jobs require an active assignment; cancellation jobs may run after unassignment. Cross-organization targets fail without reading or writing the other tenant's data.

## Reconciliation

Report candidates without changing data:

```bash
pnpm calendar:reconcile
pnpm calendar:reconcile -- --organization-id <organization-id>
```

Repair candidates:

```bash
pnpm calendar:reconcile -- --apply
pnpm calendar:reconcile -- --organization-id <organization-id> --apply
```

The command repairs active, non-terminal assignments that have no mapping, an error/unsendable mapping, a pending mapping without an active job, or a mapping that no longer matches the current Google/email route. It is organization-scoped when requested, idempotent, and safe to invoke concurrently. Schedule the all-organization `--apply` command in the existing job runner; a 5–15 minute interval keeps producer failures bounded without replacing the worker queue.

The command prints JSON and exits non-zero when any candidate fails. Operators should inspect `shoot_calendar_events.last_error`, correct invalid crew/contact/integration data, and rerun reconciliation.

## Migration and rollback

Migration `0042_calendar_delivery_identity.sql` adds enum values and the job delivery key. Apply it before deploying producers that write `unsendable` or `delivery_key`.

Rollback the application before the schema. PostgreSQL enum values are intentionally retained on rollback; drop only the partial index and `delivery_key` column after confirming no deployed producer depends on them.
