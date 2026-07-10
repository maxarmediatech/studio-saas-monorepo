# Core Product Remediation

> **Read when:** prioritizing or changing payments, invoices, expenses, subscriptions, calendar delivery, submissions, or WhatsApp reliability.
>
> **Status:** audit-response index. Create or expand a domain implementation plan only when that slice starts.
>
> **Accountable:** Rakesh. Engineering and product/finance owners must be assigned per milestone before implementation.

## Outcome

Stop active financial inconsistency first, determine whether existing production data has drifted, then repair transactional and asynchronous workflows in severity order.

The audit diagnosis remains valid: several business transitions update multiple tables or states without one transaction owner, database enforcement, or retry-safe execution. The review of the original plan confirmed the major code findings, while correctly identifying that the plan mixed unrelated domains and understated product and backfill decisions.

## Decisions incorporated from review

Accepted:

- Split execution by domain; keep this file as the severity-ranked index.
- Treat payment immutability and reversal as an explicit product/finance decision.
- Add an immediate received-payment edit/delete safety fix before the long-term redesign.
- Make mismatch taxonomy, resolution policy, and ownership Phase 0 deliverables.
- Add payment API idempotency.
- Use periodic seat reconciliation before introducing a subscription job table.
- Add stale review claim release/reassignment.
- Separate database constraints from application-level cross-entity validation.
- Make financial invariant reconciliation permanent after repair.

Accepted with qualification:

- Standardize worker claim, lease, backoff, and stale recovery behavior before adding more variants. Do not block urgent WhatsApp fixes on a repo-wide worker rewrite or queue-library adoption.
- The calendar worker already implements batch claiming and stale-processing recovery. Calendar remediation is limited to producer-side job loss, ICS fallback, and missing-assignment reconciliation.
- A queue library such as pg-boss or Graphile Worker requires an ADR and operational justification; it is not assumed by this plan.

## Operating principles

1. **One service owns a business transition.** Procedures call a domain service rather than updating related records independently.
2. **The database enforces what it can.** Use unique/check/composite constraints where practical; use transactional service validation for cross-entity rules that the schema cannot express cleanly.
3. **Claims and state transitions are atomic.** Prefer conditional updates with RETURNING over read-validate-write.
4. **External retries are idempotent.** A retried request returns its original result and does not duplicate business effects.
5. **Async work is resumable.** Use explicit state, attempts, next-attempt time, lease ownership/expiry, and deterministic identity.
6. **Financial history is auditable.** Do not silently rewrite or delete issued financial history.

## Severity and milestone index

| Priority | Milestone | Risk addressed | Accountable role | Dependency |
|---|---|---|---|---|
| P0 | Freeze or safely reconcile payment amount edits/deletes | Active receipt/invoice corruption | API/DB + product | None |
| P0 | Financial mismatch report and resolution policy | Unknown existing drift | API/DB + product/finance | None |
| P0 | Payment creation idempotency | Client retry duplicates | API/DB | Contract decided in implementation PR |
| P1 | Atomic payment and schedule transitions | Concurrent double application | API/DB | P0 regression tests |
| P1 | Receipt/invoice constraints and reconciliation | Cross-linked/duplicate records | API/DB | Mismatch policy |
| P1 | Invoice mutation and numbering integrity | Incorrect totals/random conflicts | API/DB | Financial transaction conventions |
| P1 | WhatsApp merge blockers | Dropped/duplicated messaging work | Messaging | WhatsApp dev branch |
| P2 | Submission state-machine integrity | Double claims/conflicting reviews | API | None |
| P2 | Expense profitability source of truth | Conflicting profit reports | Product + API/DB | Allocation rules |
| P2 | Calendar producer/fallback fixes | Missing crew invitations | API + worker | Existing calendar job model |
| P2 | Billing ownership and seat convergence | Access/seat drift | Auth/billing | Seat-lag decision |

Calendar dates should be assigned only after the responsible engineer and product/finance decision owner are named. Milestones are ordered by dependency and production risk rather than treated as one 15-PR project.

## Phase 0 — Stop new corruption and classify existing data

### 0.1 Tactical received-payment safety fix

Ship independently of the long-term accounting design:

- Continue allowing metadata-only edits such as notes or reference values.
- Reject amount changes when a payment already has a receipt, invoice application, or schedule effect unless the operation reconciles every dependent record atomically.
- Reject destructive deletion of issued/applied payments.
- Audit delete-received alongside amount editing.
- Return a clear product message explaining why the financial amount cannot currently be changed.
- In the same PR, disable the amount, payment method, and date fields in PaymentEditSheet for protected payments and show the reason inline; keep metadata edits available.

This safety behavior remains until product/finance approves either reversal/replacement or a fully specified correction workflow.

### 0.2 Regression tests

Add tests before permanent implementation for:

- Amount edit with receipt and invoice.
- Payment deletion with receipt, invoice, and schedule.
- Concurrent schedule conversion.
- Concurrent payments against one schedule.
- Cross-booking receipt links.
- Duplicate client retry of payment creation.
- Transaction rollback after any dependent write fails.

Concurrency tests must run against PostgreSQL, not mocks only.

### 0.3 Mismatch taxonomy and policy

The reconciliation report is a decision tool, not an automatic migration.

| Mismatch class | Proposed source of truth | Default handling |
|---|---|---|
| Booking total differs from active payments | Active received payments | Safe recalculation after link validation |
| Schedule paid amount differs from assigned active payments | Active assigned payments | Safe recalculation after link validation |
| Invoice paid/status differs from valid applications | Valid applied payments | Recalculate after validating links |
| Receipt amount differs from its payment | No automatic assumption | Product/finance review |
| Receipt remains active for deleted payment | Financial history policy | Product/finance review |
| Payment, receipt, invoice, and booking disagree | No automatic assumption | Manual review |
| Multiple receipts for one payment | Issuance history | Manual review |
| Multiple invoices for one schedule | Issuance history | Manual review |

Ownership:

- Engineering produces evidence, proposed safe fixes, and before/after output.
- Product/finance approves financial-document history decisions.
- Operations reviews ambiguous records and records the chosen resolution.

Every mismatch must be repaired or assigned a documented resolution state and owner. An unexplained mismatch does not get silently normalized.

For every manual or product/finance decision, record the decision date, decider, evidence, options considered, rationale, consequences, and revisit condition. When one person holds multiple roles, preserve the reasoning explicitly rather than implying an independent sign-off.

Suggested modes:

~~~text
--report
--fix-safe
--fix-approved <decision-file>
~~~

Phase 0.3 implementation lives in [financial-mismatch-reconciliation.md](./financial-mismatch-reconciliation.md). It requires `--organization-id`, supports `--report` and conservative `--fix-safe`, and emits sorted machine-readable JSON. Alert only on actionable invariant failures; this is financial reconciliation, not a generic observability project. The approved-decision shape is [financial-mismatch-decision-template.json](./financial-mismatch-decision-template.json). `--fix-safe` never changes issued-document history; ambiguous records remain for manual review.

### 0.4 Payment API idempotency

Decision implemented in the payment-creation idempotency PR:

- API/DB engineering owns this request contract. Product review is required only if the client-visible workflow changes.
- `idempotencyKey` is required for received-payment creation and schedule conversion. It is an opaque, UUID-compatible token of 16–128 characters using letters, numbers, `.`, `_`, `:`, or `-`.
- Uniqueness scope is organization + operation (`create_received_payment` or `convert_schedule_payment`) + key. Reuse across organizations or operations is valid.
- The server fingerprints a canonical request: normalized two-decimal money, explicit nulls/defaults, fixed attachment fields, and the supplied effective date. Property order, key, and actor do not affect it. Every business-effect field does. Schedule conversion therefore requires `receivedDate` rather than choosing a server-time default.
- The browser keeps one key for the same normalized submitted payload and all retries. It rotates only after acknowledged API success or when the submitted business payload changes; a transport retry never generates a new key.
- The record stores fingerprint, status, resulting received-payment ID, and an immutable response snapshot. Same key and fingerprint returns that original snapshot after permission and tenant/resource validation, without repeating payment, receipt, cache, or activity effects. A different fingerprint returns deterministic conflict. Product deletion is a soft delete: replay then returns a clear unavailable conflict and cannot recreate under the key. A future hard-purge job must delete the idempotency tombstone in the same purge transaction before deleting its referenced payment.
- Claim insert, business effects, immutable snapshot, and completion commit in one database transaction. `processing` is only an in-transaction state and is never intentionally committed, so a crash rolls back both claim and effects. No lease or stale-processing recovery job is needed for this invariant; a committed processing row is treated as exceptional corruption and returns retry conflict.

## Phase 1 — Permanent payment ledger

### 1.1 Product/finance decision: correction behavior

Choose explicitly:

**Preferred: reversal and replacement**

- Financial amount becomes immutable after creation.
- Correction creates a reversal linked to the original payment.
- Original receipt becomes void; it is not deleted.
- Replacement payment produces a new receipt.
- Reversal stores amount, reason, actor, and timestamp.

**Compatibility path: corrected payment**

- Amount edits remain user-visible.
- One transaction updates payment, booking, schedule, receipt, and invoice.
- Issued receipt correction/versioning behavior is explicitly defined.
- Activity records preserve before/after values.

Do not describe reversal/replacement as approved until the decision owner signs off.

### 1.2 Central payment transition services

Suggested ownership:

~~~text
packages/api/modules/studio-payments/services/
  record-payment.ts
  correct-payment.ts
  reverse-payment.ts
  apply-payment-to-schedule.ts
  reconcile-payment-ledger.ts
~~~

Each operation owns one database transaction covering:

- Received payment.
- Booking collected total.
- Schedule paid amount/status.
- Receipt creation, correction, or voiding.
- Invoice paid amount/status.
- Activity record.
- Idempotency result.

### Financial transition lock order

For every payment, receipt issuance, receipt void, or schedule mutation, acquire
row locks in one order: **booking → invoice → payment schedule → received
payment → receipt**. A preliminary lookup may discover IDs only; re-read and
validate every row after its lock. Operations that do not involve a row simply
skip that position. This keeps schedule application compatible with the existing
booking/invoice/payment protocol and avoids schedule/invoice lock inversions.

Procedures should validate input/authorization and delegate the business transition.

### 1.3 Financial invariants

- Booking collected amount equals active received payments.
- Schedule paid amount equals active assigned payments.
- Invoice paid/status equals valid applied payments.
- Receipt, payment, invoice, and booking share the intended booking.
- At most one active receipt exists for a received payment.
- A reversed payment has no active ordinary receipt.

### 1.4 Atomic schedule conversion

Use a conditional claim or a row lock inside the transaction. Example:

~~~sql
UPDATE payment_schedules
SET conversion_status = 'processing',
    conversion_started_at = now()
WHERE id = $id
  AND conversion_status = 'pending'
RETURNING *;
~~~

Persist conversion status, start/completion times, and converted payment ID. If no row returns, return the existing completed result or a conflict based on current state.

### 1.5 Enforcement

Database-level:

- Unique active receipt per received payment.
- Unique invoice per non-null payment schedule.
- Check constraints preventing invalid negative values where applicable.
- Consider composite unique keys and foreign keys where they cleanly enforce booking/organization ownership.

Service-level:

- Verify payment, receipt, invoice, schedule, and booking relationships inside the transaction.
- Verify overpayment policy using locked/current values.

## Phase 2 — Invoice integrity and numbering

### 2.1 Document number allocation

Replace MAX + 1 with an organization/document-type sequence:

~~~text
document_sequences
- organizationId
- documentType: booking | invoice | receipt
- prefix
- nextValue
- updatedAt
~~~

Allocate using an atomic update/upsert in the caller transaction. This intentionally serializes low-volume document-number allocation per organization and document type; do not reuse it for high-volume event IDs.

### 2.2 Invoice mutations

For add/update/remove line item and finalization:

1. Start transaction.
2. Lock or conditionally transition the invoice.
3. Revalidate editable status inside the transaction.
4. Apply mutation.
5. Recalculate totals.
6. Persist totals and commit.

Count remaining line items only after the lock. Finalized invoice totals are immutable document snapshots.

### 2.3 Acceptance tests

- Concurrent line-item edits preserve correct totals.
- Two removals cannot remove the last required item.
- Finalization racing with an edit allows one valid transition.
- Concurrent invoice creation for one schedule creates exactly one invoice.
- Concurrent number allocation returns distinct sequential numbers.

## Phase 3 — WhatsApp merge gates

WhatsApp implementation details belong in [whatsapp-module.md](./whatsapp-module.md). Before merging the dev implementation into main, that plan must cover these P1 gates:

- Existing webhook rows are retried unless they are actually processed.
- Contact identity is unique by account and WhatsApp ID.
- Conversation creation is conflict-safe.
- Outbox and media claims recover expired processing leases.
- Provider-accepted/local-unknown deliveries are not blindly resent.
- Campaign recipients have a durable unique campaign/contact ledger.
- Campaign counts represent real state transitions, not enqueue attempts.
- Message delivery states are monotonic and idempotent.
- Opt-out/block/account state is rechecked immediately before delivery.
- Automation runs/actions are durable; wait actions resume.

### Worker standardization

Before adding another claim implementation:

1. Inventory calendar, SMS, and WhatsApp job-state contracts.
2. Define common status, attempts, next-attempt, lock/lease, stale-recovery, and error semantics.
3. Reuse shared backoff/time/transition helpers where they reduce duplication.
4. Keep table-specific claiming SQL when a generic Drizzle abstraction would obscure correctness.
5. Write an ADR before adopting pg-boss, Graphile Worker, or a shared central jobs table.

Urgent WhatsApp retry fixes do not wait for a repo-wide worker migration.

## Phase 4 — Workflow consistency

### 4.1 Submission claims and decisions

Claim via conditional update:

~~~sql
UPDATE assignment_submissions
SET status = 'in_review',
    reviewed_by = $user_id,
    review_claimed_at = now()
WHERE id = $id
  AND organization_id = $organization_id
  AND status = 'submitted'
RETURNING *;
~~~

If nothing returns, distinguish idempotent same-reviewer claim from another reviewer conflict.

Review decisions update only where status is in_review and reviewer matches. Submission and parent task/deliverable update in one transaction; notifications happen only after success.

Allowed transitions:

~~~text
submitted → in_review
in_review → approved | revision_requested | rejected
in_review → submitted       # explicit unclaim/release
revision_requested → submitted
~~~

Define an administrative reassignment action and a stale-claim policy. Do not silently expire active review work without recording who released or reassigned it.

### 4.2 Expense profitability

Product must decide:

- Whether shoot expenses roll up to the booking.
- How crew-wide expenses are allocated.
- Whether one expense can target multiple bookings.

Recommended source of truth:

- expenses stores the source transaction.
- expense_allocations stores canonical allocation.
- Shoot allocations resolve to the parent booking.
- Unallocated crew costs are organization overhead.

Initially calculate profitability from allocations. Add a booking cache only if measured query cost requires it, with one writer and reconciliation. Dashboard, booking stats, reports, exports, and booking-filtered pickers must use the same allocation logic.

### 4.3 Calendar delivery

The existing calendar worker already claims batches and recovers stale processing. Do not replace that machinery in this phase.

Fix only the confirmed gaps:

~~~text
Google connected → Google event
Otherwise, crew email exists → ICS email
Otherwise → explicit unsendable status
~~~

- Registered crew without Google must receive ICS when email exists.
- Producer-side job creation failure must leave a discoverable pending/error state.
- Add reconciliation for assigned crew with no calendar mapping/job.
- Preserve the existing worker's attempts, retry, and stale recovery behavior.

### 4.4 Subscription ownership and seats

- Replace raw role string equality with normalized role/permission helpers.
- Trigger best-effort seat updates after all membership mutations.
- Add a periodic idempotent reconciliation that computes desired seats from active membership and pushes provider state.
- Record the last successful reconciliation and actionable error.

Do not create subscription_sync_jobs unless the product requires near-immediate seat convergence or periodic reconciliation proves insufficient.

## Rollout strategy

Use expand-migrate-enforce-contract per domain:

1. Add compatible columns/tables/indexes.
2. Deploy readers that understand old and new data.
3. Backfill and classify mismatches.
4. Enable new writers.
5. Apply safe and approved repairs.
6. Enforce constraints.
7. Remove obsolete paths.

Do not combine payment, invoice, and WhatsApp schema changes in one release.

## Proposed PR sequence

### Payment track

1. fix: guard received payment amount edits/deletion and update the edit UI
2. test: add payment ledger regression and concurrency coverage
3. feat: add financial mismatch report and decision format
4. feat: add payment-creation idempotency
5. fix: make payment and schedule transitions atomic, including conversion retry safety
6. feat: implement approved payment correction model
7. fix: enforce receipt and schedule-invoice invariants
8. chore: reconcile approved production mismatches

### Invoice track

1. feat: add document sequence allocator
2. fix: serialize invoice mutations
3. test: cover invoice concurrency and finalization

### WhatsApp track

Maintain its PR sequence in [whatsapp-module.md](./whatsapp-module.md), gated by the P1 requirements above.

### Workflow track

1. fix: make submission claims and reviews atomic
2. refactor: establish canonical expense allocation queries
3. fix: add calendar ICS fallback and producer reconciliation
4. fix: normalize billing ownership and reconcile seats

Tracks may proceed independently after their product decisions and data dependencies are satisfied.

## Release gates

- No newly known path can create a ledger mismatch.
- Every existing mismatch is repaired or has an approved resolution state and owner.
- PostgreSQL concurrency and idempotency tests pass.
- Migrations are rehearsed on a production-sized sanitized dataset.
- Rollback preserves financial history and issued document numbers.
- Scheduled financial reconciliation passes after deployment.
- Relevant tests, type-check, lint, build, and end-to-end flows pass.

## Immediate starting slice

1. Guard received-payment amount edits and deletion.
2. Add regression tests for the confirmed stale receipt/invoice behavior.
3. Produce the read-only mismatch report and decision taxonomy.
4. Decide reversal/replacement versus corrected-payment behavior.
5. Add payment idempotency.
6. Make schedule conversion atomic.

This sequence stops active corruption before the larger domain redesign while preserving a clear route to the long-term ledger model.
