# Review: Core Product Remediation Plan

> Opinionated review of [core-product-remediation.md](./core-product-remediation.md), grounded against the codebase on 2026-07-10 (branch `main`).

## Verdict

The plan's diagnosis is **accurate — every major claim I checked is confirmed in the code**. The engineering fundamentals (atomic claims, DB-enforced invariants, reversal-not-mutation, resumable async, expand-migrate-enforce-contract rollout) are right, and the recommended starting slice is well-judged.

The weaknesses are structural: the plan is three plans in one document, hides its two hardest problems (backfill decisions and the payment-edit product change) in the margins, proposes rebuilding job/lease infrastructure that partially exists, and has no severity ranking, ownership, or timeline.

## Code verification of the plan's claims

| Claim | Status | Evidence |
|---|---|---|
| Schedule conversion race | **Confirmed** | `packages/api/modules/studio-payments/procedures/schedules/convert-schedule.ts:71` — transaction, but the "Fetch schedule with lock" comment is false: `findFirst` takes no `FOR UPDATE` lock. Two concurrent conversions can both pass the status/balance checks and double-insert `receivedAmounts`. |
| Payment edits corrupt dependent records | **Confirmed, worse than stated** | `packages/api/modules/studio-payments/procedures/received/update-received.ts` — amount edits adjust booking totals and schedule `paidAmount`, but **never touch the receipt or invoice paid-status**. An already-issued receipt silently keeps the old amount. `delete-received.ts` also exists. |
| MAX+1 number allocation | **Confirmed** | `packages/api/modules/receipts/lib/receipt-helpers.ts:32` — `findFirst … orderBy desc` + increment, with a 5-attempt retry-on-unique-violation loop bolted onto convert-schedule (`MAX_RECEIPT_INSERT_ATTEMPTS`). The retry loop is itself evidence the numbering is broken. |
| Submission claim race | **Confirmed** | `packages/api/modules/submissions/procedures/claim-submission.ts` — textbook read-validate-write with **no transaction at all**; two reviewers can both claim. |
| WhatsApp webhook not retry-safe | **Confirmed** | `packages/api/modules/whatsapp/webhook-handler.ts:198` — `findFirst` then insert; `existing → continue` means an event stored but crashed mid-processing is **skipped forever**. Business logic (contacts, conversations, automations) runs inline in the webhook request. |
| Raw role equality checks | **Confirmed** | `packages/api/modules/payments/lib/get-manageable-purchase.ts:23` — `membership.role !== "owner"`. |
| Missing regression tests | **Confirmed** | 33 test files exist, but they cover subscription checkout flows and pure helpers — nothing exercises the ledger procedures or any concurrency. Phase 0 is justified. |

## What's genuinely good

- The root-cause diagnosis (multi-table transitions with no single transaction owner) is correct, and the five operating principles all follow from it.
- Phase 0 first — regression tests plus read-only reconciliation before touching implementations — is the right order and often skipped.
- Expand-migrate-enforce-contract rollout, and refusing to bundle payment/invoice/WhatsApp migrations in one deployment.
- The recommended starting slice targets the highest-severity risk with the smallest coherent unit of work.

## Where I push back

### 1. Three plans wearing a trench coat
Payments/invoices (Phases 1–2), workflow transitions (3–6), and WhatsApp (7) share a root cause but nothing else — different data, different risk, different branch (WhatsApp gates a dev-branch merge, not production remediation). A 15-PR sequence spanning all of them will go stale by PR 6. Split it: keep this document as the audit-response index; grow real plans only for the slice being worked. Phase 7 belongs with the WhatsApp module docs.

### 2. The hardest problem is one sentence
"Backfill and produce reconciliation reports" is where the project will actually bleed time. If `totalReceived` doesn't match active payments today, someone must decide **which side is truth, per mismatch class** — a product/finance decision, not a migration step. The `--fix-safe` / `--fix-with-review` modes gesture at this, but the plan never says who reviews, what the decision rules are, or what happens to unexplainable rows. The release gate "no unexplained mismatch" will block indefinitely without that. Make **mismatch taxonomy + resolution policy (with an owner)** an explicit Phase 0 deliverable.

### 3. Payment immutability is a product decision disguised as a design choice
Reversal-plus-replacement is the right accounting model, but it changes user-visible behavior (no more editing a typo'd payment; clients see a reversal + new receipt). The plan flags product decisions for expenses (Phase 4) but not this bigger one. And having seen `updateReceived` leave stale receipts behind, **freezing or fixing amount edits belongs in the urgent starting slice**, not a later conversation — even the plan's "temporary" escape hatch (route edits through a reconciliation service that also fixes the receipt) beats what's live today. Note the escape hatch is where teams actually land; design it as a real path, because "temporarily" is forever.

### 4. Don't build a fifth bespoke lease system
The plan specifies four near-identical retry/lease schemas (calendar, `wa_events`, outbox, automations: `status / attemptCount / nextAttemptAt / leaseExpiresAt / lastError`). But the repo **already has hand-rolled claim workers**: `claimJobBatch` in `services/calendar-worker/src/index.ts:46` and `claimMessages` in `services/sms-worker/src/worker.ts:107`, plus a `whatsapp-worker` service — and no queue library anywhere. Before Phases 6–7, extract one shared claim/lease helper (or adopt pg-boss / graphile-worker) and migrate the existing workers onto it. Otherwise the remediation reproduces the disease it's treating. Relatedly, **Phase 6's premise needs re-checking** — a calendar worker with batch claiming already exists, so the audit may predate some worker code; re-verify each Phase 6 claim before scoping.

### 5. Similarly, `subscription_sync_jobs` is heavier than the problem
Seat changes are low-frequency. A periodic reconciliation job alone — compute desired seats from membership, push to provider idempotently — gets convergence with a fraction of the machinery. The job table is only worth it if seat lag of minutes is unacceptable.

### 6. Missing entirely
- **Severity ranking, owners, timeline.** The payment bugs are live corruption paths (`updateReceived` is corrupting receipts on every amount edit today); most of the rest are races requiring concurrency. Without ranking, PR 8 looks equal to PR 3, and it isn't. The plan also doesn't allow for a tactical hotfix ahead of Phase 0's careful test-writing if live corruption warrants one.
- **Permanent observability.** The Phase 1 invariants should become scheduled checks that alert, not migration-era reports — otherwise the data re-drifts silently after remediation ends.
- **API-boundary idempotency.** Atomic claims fix concurrent writers; nothing addresses client retries double-creating payments. Add idempotency keys to payment creation.

### 7. Nits
- Phase 1's "service-level verification that receipt/payment/invoice/booking share a booking" is listed under *Database constraints* but is application-level — contradicting operating principle 2. Either add composite FKs (`(id, bookingId)` references) or move it out of that section.
- The Phase 2 sequence table serializes writes per org per document type — fine for invoices, but state it so nobody reuses it for high-volume numbering.
- The Phase 3 state machine has no exit from a stale `in_review` claim (reviewer walks away). Claims need timeouts or an unclaim path, same as the leases elsewhere in the plan.

## Recommended changes to the plan

1. Split into per-domain plans; keep this document as the index.
2. Add to the starting slice: **freeze or fix `updateReceived` amount edits** (and audit `delete-received`).
3. Promote to explicit Phase 0 deliverables: mismatch taxonomy + resolution policy with a named owner, and a severity-ranked bug list.
4. Add a pre-Phase-6 task: unify on one claim/lease mechanism (shared helper or queue library) and re-verify Phase 6 claims against the current calendar worker.
5. Replace `subscription_sync_jobs` with periodic idempotent reconciliation unless seat-lag requirements say otherwise.
6. Add idempotency keys at payment-creation API boundary; make reconciliation checks permanent and alerting.
