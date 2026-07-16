# Core remediation Release Batch 4 — WhatsApp additive reliability

> **Read when:** reviewing, rehearsing, or deploying
> `codex/core-remediation-release-4-whatsapp-additive`.

## Scope

This branch builds on Release Batch 3 commit `42469041`. It adds the approved
durable manual-send, webhook, outbox, media, campaign, and automation behavior,
plus:

- `0041_whatsapp_additive_reliability.sql`
- SHA-256: `6699c731ee9069f3750dccc962b66834fd14ee74a9ff86a08fce43dc89b9a69a`

Migration `0041` is generated from the exact Batch 3 `0040` snapshot. It adds
the durable tables, state, leases, dispatch tokens, retry clocks, and indexes
needed by the Batch 4 API and worker. It also adds a compatibility trigger for
the short old-API/new-schema window: an old webhook success is classified as
processed, while an old webhook failure remains retryable.

The migration deliberately does **not** add these enforcement rules:

- unique contact identity `(account_id, wa_id)`;
- unique provider-message identity `(account_id, provider_message_id)`;
- unique outbox effect `(message_id)`;
- non-null contact `account_id`.

Those belong to Release Batch 5, after its organization-scoped identity report
and reviewed cleanup. During Batch 4, new writes use transaction advisory locks
that match the future identity keys. Historical ambiguity is stopped for manual
reconciliation instead of guessed or duplicated.

## Required order

1. Record the Batch 3 application SHA, recoverable backup/snapshot, and exact
   starting ledger: 41 rows; latest migration time `1784135676915`; latest hash
   `e62798d94efd7cdb0321112b9d1b67c1d3b2cd0479bdc22895c28b734f3ebf6b`;
   ordered digest `5efd64bb2f3ea3c5815606b938351cc5`.
2. Confirm every external/mobile/custom caller of `send-text`, `send-template`,
   and `send-media` is ready to supply a stable 16–128 character idempotency
   key. The repository has no first-party web caller to migrate.
3. Pause the Batch 3 WhatsApp sender worker and disable automatic restart. Let
   active dispatches finish. Do not kill a provider call and mark it safe by
   assumption; investigate any remaining `processing` row from provider and
   database evidence.
4. Run the read-only exact-ledger, drain, and no-partial-state gate:

   ```bash
   PGOPTIONS='-c default_transaction_read_only=on -c statement_timeout=15000' \
     psql "$DATABASE_URL" -X -f \
     packages/database/drizzle/preflight/0041_whatsapp_additive_reliability.sql
   ```

5. Apply migration `0041` once from the controlled release runner. Keep the old
   sender worker stopped. The Batch 3 API may remain online briefly: old-shape
   inserts receive safe defaults, and the compatibility trigger preserves
   webhook retry truth.
6. Verify 42 ledger rows; latest migration time `1784136606186`; latest hash
   `6699c731ee9069f3750dccc962b66834fd14ee74a9ff86a08fce43dc89b9a69a`;
   ordered digest `c9d1ba546f73e265e7033dcbac3c2009`. Verify every new object/column/index,
   webhook backfill counts, and zero `processing` outbox rows. Record identity
   duplicate counts without changing them; Batch 5 owns cleanup.
7. Replace the old API instances with Batch 4 instances while the worker stays
   paused. Avoid a prolonged mixed API contract: old sends accept no key, while
   Batch 4 requires one. Meta webhook retries cover a brief controlled API
   cutover; do not route test traffic to customer destinations.
8. With a test organization, accept text, template-button, and media sends and
   verify one completed idempotency claim, one message, and one pending outbox
   effect per request. Repeat each key and verify the original IDs are returned.
9. Start only the Batch 4 WhatsApp worker. Rehearse Trigger wake-up failure,
   poller recovery, concurrent polling, worker crash before dispatch, late
   provider acceptance, duplicate webhook delivery, campaign scheduling
   fairness, automation wait/recovery, and media ingest leases using approved
   non-customer accounts and recipients.
10. Re-run read-only counts and observe database errors, advisory/row lock waits,
    event/outbox leases, delivery-unknown rows, provider IDs, campaign recipient
    truth, and automation actions before declaring staging complete.

## Compatibility and roll-forward

- Batch 3 API with Batch 4 schema: supported for the short migration window.
  Old webhook writes are normalized by the compatibility trigger.
- Batch 3 sender worker with Batch 4 schema: keep stopped. A crash after it
  writes legacy `processing` state has no durable dispatch token or lease.
- Batch 4 API/worker with Batch 3 schema: not supported. Apply `0041` first.
- Batch 4 code with historical identity duplicates: supported by refusing the
  ambiguous identity for manual reconciliation. Other clean identities remain
  available; no cleanup is guessed.

If `0041` succeeds but application deployment fails, the Batch 3 API can remain
on the additive schema while the sender worker stays paused. Fix forward and
deploy the Batch 4 worker; do not delete tables, enum values, events, messages,
outbox rows, dispatch evidence, or migration history. If a provider outcome is
uncertain, stop replacement delivery and reconcile it from provider evidence.

## Local proof — 2026-07-15

- The read-only preflight passed on the exact Batch 3 ledger, rejected one
  injected partial column, and rejected an already-migrated ledger.
- Fresh and representative Batch 3-upgraded PostgreSQL 18 databases migrated
  to 42 rows and produced identical normalized schema dumps.
- Deliberate historical contact, provider-message, and outbox duplicates did
  not block the additive migration and were rejected by the compatibility
  runtime as requiring reconciliation.
- Legacy failed events became pending with `processed_at = NULL`; processed and
  pending events retained their correct meaning.
- Old-shape post-migration event writes classified success as processed and
  failure as retryable. An old-shape pending outbox insert succeeded with safe
  defaults.
- Focused API PostgreSQL tests: 9 passed. WhatsApp worker PostgreSQL tests:
  12 passed. These include concurrent contact/inbound identity, manual-send
  atomicity/rollback/idempotency, exact Trigger-failure poller recovery,
  provider late acceptance, campaign/automation durability, and outbox leases.
- The full API suite passed 366 tests with one intentional skip. API, database,
  web, WhatsApp schema/runtime/outbox/worker type-checks passed; Drizzle history,
  changed-source Biome (115 files), and `git diff --check` passed.

This is local release-construction evidence, not production release approval.
Staging must retain the real preflight output, caller confirmation, migration
and lock timings, starting/ending ledgers, application SHAs, provider IDs,
smoke results, and before/after counts before production approval.
