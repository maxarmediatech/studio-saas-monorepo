# Core remediation Release Batch 5 — WhatsApp identity enforcement

> **Read when:** reviewing, rehearsing, or deploying
> `codex/core-remediation-release-5-whatsapp-enforcement`.

## Scope

This branch builds on Release Batch 4 commit `3387cbc1`. It adds a read-only,
organization-scoped WhatsApp identity report and:

- `0042_whatsapp_identity_enforcement.sql`
- SHA-256: `2da65c47ac692d091ed7f40e479697aa1e4707ceda4a6fae5b9be0ac1ff8263c`

The report covers:

- contacts with a missing, unknown, or cross-organization account;
- duplicate contact `(account_id, wa_id)` identity;
- duplicate provider-message `(account_id, provider_message_id)` identity;
- duplicate outbox `(message_id)` effects;
- outbox rows whose message is missing or has conflicting ownership.

Raw WhatsApp and provider identities are omitted from report output. Stable row
IDs and a deterministic evidence hash derived only from those row IDs remain
available for an authorized reviewer. There is no generic repair flag: every
manual issue requires a reviewed one-off cleanup with its own backup/evidence.
Migration `0042` performs only one mechanical repair: a
NULL-account contact may inherit the organization's account when that
organization has exactly one account and the prospective `(account_id, wa_id)`
identity is unique across both assigned and unassigned contacts.

After the report is clean, `0042` makes contact `account_id` non-null and adds
the three unique indexes listed above. Its first statement repeats the report's
blocking invariants and names the report command in its abort message.

## Required order

1. Record the Batch 4 application SHA, recoverable backup/snapshot, and exact
   starting ledger: 42 rows; latest migration time `1784136606186`; latest hash
   `6699c731ee9069f3750dccc962b66834fd14ee74a9ff86a08fce43dc89b9a69a`;
   ordered digest `c9d1ba546f73e265e7033dcbac3c2009`.
2. Run and retain the report for every organization:

   ```bash
   pnpm whatsapp:migration-preflight --organization-id ORGANIZATION_ID
   ```

   Then run the global gate to catch identities spanning organization rows:

   ```bash
   pnpm whatsapp:migration-preflight --all-organizations
   ```

3. Review any `contact_missing_account_safe_backfill` rows. Migration `0042`
   may repair only these rows. For every `manual` row, create a sanitized
   decision record containing the report output/hash, row IDs, provider or
   ownership evidence, exact proposed SQL, backup reference, reviewer, and
   before/after checks. Execute it only with separate approval. Never choose a
   winning provider ID or external effect by timestamp alone.
4. Repeat both report scopes. Continue only when
   `blockingIssueGroupCount = 0`; retain any reviewed migration-safe rows.
5. Pause the WhatsApp API mutation/webhook cutover and sender worker. Drain all
   active outbox dispatches. This freezes identity rows between the reviewed
   report and index creation and gives the generated non-concurrent indexes a
   controlled lock window.
6. Run the read-only exact-ledger/data/schema gate:

   ```bash
   PGOPTIONS='-c default_transaction_read_only=on -c statement_timeout=15000' \
     psql "$DATABASE_URL" -X -f \
     packages/database/drizzle/preflight/0042_whatsapp_identity_enforcement.sql
   ```

7. Apply migration `0042` once from the controlled release runner. Measure its
   table-lock wait and duration. Any blocker aborts the transaction; run the
   named report and fix forward rather than bypassing the gate.
8. Verify 43 ledger rows; latest migration time `1784138577327`; latest hash
   `2da65c47ac692d091ed7f40e479697aa1e4707ceda4a6fae5b9be0ac1ff8263c`;
   ordered digest `9323b3681d619cb16b845e538ca8b6d6`. Verify contact account null count is zero
   and all three unique indexes are valid.
9. Re-run the global report and require zero issue groups. Start the Batch 4/5
   API and worker, then smoke concurrent outbound contact creation, duplicate
   inbound webhooks, automation recovery, campaign recipient delivery, and
   manual-send idempotency using non-customer accounts and recipients.
10. Observe unique/not-null violations, identity advisory-lock waits, failed
    webhook events, outbox leases, provider IDs, and delivery-unknown rows
    before declaring staging complete.

## Compatibility and roll-forward

- Batch 4 application/worker with Batch 5 schema: supported. Batch 4 already
  uses the same advisory identity locks and does not depend on the deferred
  unique indexes for `ON CONFLICT` writes.
- Batch 5 application with Batch 4 schema: supported for report/review and a
  short cutover; all application-created contacts already include account ID.
- Dirty Batch 4 data with migration `0042`: deliberately blocked before any
  backfill or index creation.

If `0042` aborts, the transaction leaves the Batch 4 schema and ledger intact.
Return to report/review/cleanup and retry. If `0042` succeeds but application
deployment fails, the Batch 4 application can remain on the enforced schema.
Do not drop constraints, rewrite migration history, restore duplicate effects,
or clear ownership merely to roll back; fix the application forward.

## Local proof — 2026-07-15

- The report identified deliberate duplicates for all three enforced keys,
  omitted raw identities, emitted row-ID evidence hashes, and filtered cross-organization
  issues correctly.
- A safe single-account NULL contact was reported as migration-safe, passed the
  SQL preflight, and received the only provable account during migration.
- Deliberate dirty data failed the report, read-only SQL preflight, and migration
  hard gate. The failed migration retained the 42-row Batch 4 ledger.
- After reviewed cleanup of only the synthetic rehearsal rows, report and
  preflight passed, migration reached 43 rows, and the report became empty.
- Fresh, safe-upgraded, and cleaned-dirty PostgreSQL 18 databases produced
  identical normalized schema dumps. NULL contact accounts and duplicates for
  each enforced key were rejected by the database.
- The pre-enforcement report suite passed 10 PostgreSQL scenarios. On the final
  enforced schema, focused WhatsApp API tests passed 9/9, worker tests passed
  12/12, and the scripts suite passed 43 tests with the pre-enforcement-only
  PostgreSQL report test intentionally skipped.
- API, database, web, scripts, WhatsApp database/runtime/outbox/worker
  type-checks passed. Drizzle migration-history check, changed-source Biome,
  and `git diff --check` passed.

This is local release-construction evidence, not production release approval.
Staging must retain the actual reports, decision records, cleanup SQL/reviewer,
backup reference, migration/lock timings, starting/ending ledgers, application
SHAs, smoke results, and before/after counts before production approval.
