# Async Worker State Contract Inventory

> **Read when:** adding or changing calendar, SMS, or WhatsApp queue claims, retries, leases, or recovery.

## Purpose

Keep worker behavior comparable without hiding table-specific correctness behind a generic queue abstraction. This inventory records the contracts present when the WhatsApp P1 reliability work started.

| Worker | Ready states | Claim | Retry clock | Lease | Stale recovery | Terminal states |
| --- | --- | --- | --- | --- | --- | --- |
| Calendar | `pending`, due `retry` | Batch update with `FOR UPDATE SKIP LOCKED` | `nextAttemptAt`, bounded backoff | `processingStartedAt` timeout | `recoverStaleProcessingJobs` returns stale rows to retry or terminal failure | `completed`, exhausted `failed` |
| SMS | `pending`, due `failed` | Conditional update with row locking and `lockedBy` | `nextAttemptAt`, exponential backoff | `lockedAt` + `processingStartedAt` | `recoverStuckMessages` clears stale ownership and schedules retry | `sent`, exhausted `failed` |
| WhatsApp outbox | `pending`, due `failed` | Conditional update with `lockedBy` and `leaseExpiresAt` | `nextAttemptAt`, bounded backoff | Explicit owner and expiry | Pre-dispatch expiry returns to `pending`; post-dispatch expiry becomes `delivery_unknown` | `sent`, exhausted `failed`, `delivery_unknown` |
| WhatsApp inbound media | Due `pending` | Conditional update with `ingestLockedBy` and `ingestLeaseExpiresAt` | `nextIngestAttemptAt`, bounded backoff | Explicit owner and expiry | Expired processing returns to `pending`; the storage key is deterministic for safe replay | `ready`, exhausted `failed` |

## Shared semantics

- A claim must be one conditional database transition, not read then write.
- Attempts increment when a claim succeeds.
- A retry clock is distinct from a processing lease.
- Completion/failure updates require the current lease owner.
- Stale recovery is part of every poll cycle.
- External dispatch needs a durable boundary. Work that expired before dispatch can be retried; work that may have reached a provider must not be blindly resent.
- Backoff/time helpers may be shared later. Claim SQL remains table-specific where it expresses materially different safety rules.

## Deliberate non-decision

No central job table or queue library is adopted here. pg-boss, Graphile Worker, or a repo-wide queue abstraction still requires an ADR covering deployment, ownership, migration, and operating cost.
