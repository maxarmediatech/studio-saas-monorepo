# Core Product Remediation — Adversarial Follow-up Plan

> **Read when:** continuing, reviewing, merging, or deploying `codex/core-product-remediation` after the adversarial review.
>
> **Status:** implementation complete through rollout tooling; final validation and real-data deployment gates remain.
>
> **Accountable:** Rakesh. When Rakesh fills engineering, product, finance, and operations roles, each decision record must preserve evidence, alternatives, reasoning, and consequences instead of implying an independent sign-off.

## Outcome

Close the release-gate gaps without reopening the financial architecture that passed review:

1. Give every WhatsApp campaign one durable execution path.
2. Make failed webhook and outbox work autonomously recoverable without risking duplicate sends.
3. Turn the existing migration chain into staged production releases instead of one cross-domain deployment.
4. Finish booking-number concurrency and recurring reconciliation.
5. Preserve the deliberate rule that issued or voided financial history is corrected, never directly rewritten.

This is a follow-up to [core-product-remediation.md](./core-product-remediation.md), not a replacement for its implemented domain contracts. Previous validation in [core-product-remediation-final-validation.md](./core-product-remediation-final-validation.md) remains useful as baseline evidence, but its merge recommendation is superseded until this plan's gates pass.

## Review disposition

| Review claim | Decision | Reason |
| --- | --- | --- |
| Legacy and durable campaign engines can both send | Accept; P0 deploy blocker | `create-campaign` calls `runCampaignNow`, while the worker separately calls `processDueWhatsAppCampaigns`. They create and count effects through different models. |
| Failed webhook events lack autonomous replay | Accept; P0 deploy blocker | A repeated provider delivery can retry the event, but no poller claims old unprocessed `wa_events`. |
| Final-attempt pre-dispatch crash strands outbox work | Accept; P0 deploy blocker | Recovery returns the row to `pending` without restoring attempt eligibility; the fetch condition then excludes `attempts >= maxAttempts`. |
| Split migrations by domain | Accept intent, reject divergent lineages | Keep one Drizzle journal. Separate additive, data-repair, and enforcement changes into ordered migrations and release batches. |
| Booking reference allocation races | Accept; P1 | Booking creation still derives the next reference from the latest row instead of the transactional sequence allocator. |
| Reconciliation is not scheduled | Accept; P1 | Commands exist, but no recurring owner invokes them. |
| Voided receipts should not protect payments | Reject | Voided receipts are financial history. Ordinary edit/delete must stay blocked; correction uses reversal and replacement. Existing tests deliberately assert this policy. |
| `--fix-approved` is implied but absent | Accept documentation gap; P1 | The decision file records approval but no executor exists. Do not imply that it mutates data. |
| Repeated enqueue and claim code should be standardized | Accept as bounded cleanup; P2 | Share contracts and safe helpers, but keep table-specific SQL and do not introduce a queue library without an ADR. |

## Fixed decisions

These are not reopened during implementation:

- **One campaign owner:** `packages/whatsapp-runtime` owns campaign audience capture, recipient materialization, message/outbox creation, status projection, and campaign completion.
- **Send now means due now:** the API persists the campaign with an immediately due schedule. It does not synchronously send or call a second engine.
- **No provider call inside a database transaction:** commit `dispatchStartedAt` immediately before the call. Any crash after that boundary becomes `delivery_unknown`, never an automatic resend.
- **Attempts count provider opportunities, not harmless lease acquisition:** a crash before dispatch must not consume the final provider attempt permanently.
- **Webhook replay is at-least-once processing with idempotent effects:** durable event identity and conflict-safe business writes absorb duplicate processing.
- **One migration history, multiple releases:** never fork or hand-edit a second journal for a domain.
- **Financial history stays immutable:** an active or voided receipt keeps ordinary payment financial edits and deletion locked.
- **No generic queue rewrite:** common retry/lease utilities are allowed; a central jobs table or queue dependency requires a separate ADR.

## Work package A — One WhatsApp campaign path

**Priority:** P0. Complete before any migration or production rollout work.

### A1. Make the durable runtime the only sender

- Change `packages/api/modules/whatsapp/procedures/create-campaign.ts` so both actions only persist campaign intent:
  - `draft`: remain draft and not due.
  - `schedule`: store the requested future `scheduledAt` and a schedulable status.
  - `send`: store `scheduledAt = now` and a status eligible for worker pickup.
- Do not call `runCampaignNow` from an API request.
- Return a truthful result such as `queued`/`scheduled`; do not report completion before recipients are materialized.
- Keep authorization, account/template validation, and tenant scoping in the API transaction.
- Ensure `processDueWhatsAppCampaigns` recognizes the persisted immediate state and is the only entry to recipient materialization.

### A2. Remove the legacy orchestration

- Delete these sending responsibilities from `packages/api/modules/whatsapp/lib/campaign-engine.ts`:
  - direct message/outbox creation;
  - campaign loop execution;
  - campaign counter mutation;
  - due-scheduled processing.
- Move only genuinely reused pure audience/template helpers into a focused runtime module. Do not keep an unused compatibility sender.
- Remove every import/export and Trigger task that can invoke `runCampaignNow` or `processDueScheduledCampaigns`.
- Search both the current branch and the scoped WhatsApp code taken from `dev`; the `dev` direction is the reference for product behavior, but the durable recipient ledger remains the single execution contract.

### A3. Make campaign truth entirely ledger-derived

- `wa_campaign_recipients` is the source for queued, sent, delivered, read, failed, suppressed, and delivery-unknown counts.
- The campaign row may cache those counts, but only `refreshCampaignCounts` updates the cache.
- Completion occurs only when all frozen recipients are terminal or uncertain according to the documented state contract.
- Empty audiences complete deterministically with zero counts.
- Re-entry after a worker crash must not capture a new audience or create another message/outbox effect.

### A4. Regression tests

Add PostgreSQL-backed tests for:

1. `send` creates campaign intent but no direct message/outbox effect in the API request.
2. The worker materializes the frozen audience and creates exactly one message/outbox per recipient.
3. API retry plus concurrent worker polling still creates one recipient and one effect.
4. Two workers claim/process the same campaign without duplicate messages.
5. A campaign created as send-now receives delivered/read projections through the recipient ledger.
6. A scheduled campaign and send-now campaign use the same execution code.
7. Empty, opted-out, blocked, disconnected, and deleted-account recipients produce truthful terminal counts.

### A acceptance gate

- No production code references the legacy campaign runner.
- There is one function that turns a campaign recipient into a message/outbox effect.
- Campaign counters are never incremented as enqueue-attempt counters.
- API, worker, and PostgreSQL concurrency tests pass.

## Work package B — Durable webhook replay

**Priority:** P0. Start after A to avoid validating webhook projections against two campaign models.

### B1. Define event claim state

Prefer adding explicit fields to `wa_events` rather than inferring ownership from `processedAt`:

- `processingStatus`: `pending | processing | processed | failed`.
- `attempts` and `maxAttempts`.
- `nextAttemptAt`.
- `lockedBy` and `leaseExpiresAt`.
- `lastError`.
- Preserve `processedAt` as the successful completion timestamp.

If equivalent columns already exist, normalize their semantics instead of duplicating them. Add indexes for due work and expired leases.

### B2. Separate ingestion from replayable processing

- Webhook HTTP ingestion authenticates the request and inserts/deduplicates provider events.
- It may attempt immediate processing for latency, but processing must call the same claim/transition service as the background worker.
- A database claim must conditionally move one due event to `processing` and assign an owner lease.
- Business effects and event completion remain in one transaction.
- A rollback leaves the event retryable; a committed success records `processedAt` and terminal `processed`.
- A duplicate provider delivery returns success after checking existing state and may make a due failed event eligible, but is not the only recovery mechanism.

### B3. Add autonomous replay

- Add `processDueWhatsAppEvents` to the WhatsApp runtime/worker boundary.
- Invoke it in `services/whatsapp-worker/src/index.ts` as part of each batch, with bounded work per poll.
- Recover expired processing leases before claiming due rows.
- Apply bounded backoff to retryable failures.
- Permanent or exhausted failures remain queryable as terminal `failed`; do not delete their payload/evidence.
- Do not automatically reinterpret or mutate provider event identity.

### B4. Regression tests

1. A handler failure leaves an event due for replay.
2. Replay succeeds without another provider request.
3. Two replay workers cannot both own the event.
4. A crash rolls back business effects and permits a later replay.
5. Duplicate webhook delivery plus background replay produces one inbound message/status effect.
6. Expired leases recover; active leases do not.
7. Exhausted/permanent failures stop retrying and retain actionable error evidence.
8. Out-of-order delivery statuses remain monotonic after replay.

### B acceptance gate

- Every unprocessed event is either due, leased, or terminal with a reason.
- No `processedAt = null` event can sit forever without an explicit terminal state.
- Webhook latency does not depend on the poller, and durability does not depend on Meta redelivery.

## Work package C — Outbox final-attempt recovery

**Priority:** P0. Small isolated fix; complete with B or immediately after it.

### C1. Correct attempt semantics

Recommended implementation:

- Keep increment-on-claim for normal processing.
- When an expired lease has `dispatchStartedAt IS NULL`, atomically return it to `pending` **and decrement the attempt that never reached the provider**, with a floor of zero.
- When `dispatchStartedAt IS NOT NULL`, retain the existing `delivery_unknown` transition and never decrement/retry automatically.
- Make the recovery update conditional on `status = processing` and expired lease.
- Ensure recovered rows are immediately eligible under `attempts < maxAttempts`.

An alternative is a separate claim counter and provider-attempt counter, but that is unnecessary schema expansion for this defect.

### C2. Normalize terminal labeling

- A retryable row with attempts remaining is `failed` plus `nextAttemptAt`, or recovered `pending`.
- An exhausted provider failure is terminal `failed` with no retry time.
- A row whose provider outcome is uncertain is `delivery_unknown`.
- Never leave a `pending` row that the due query can never select.

### C3. Regression tests

1. First-attempt pre-dispatch expiry restores eligibility.
2. Final-attempt pre-dispatch expiry restores eligibility exactly once.
3. Post-dispatch expiry becomes `delivery_unknown` and is never fetched.
4. A real final provider failure remains terminal.
5. Repeated recovery polling is idempotent and never drives attempts negative.

### C acceptance gate

For every outbox row, status plus attempt/lease fields explain whether it will run again. There is no non-terminal but permanently ineligible combination.

## Work package D — Migration and production rollout repair

**Priority:** P0 for deployment. This can be designed alongside A–C, but migration edits happen after their schema needs are final.

### D1. Preserve the development lineage

- Keep the existing `0038`–`0048` journal entries as the branch's development history until a rollout strategy is chosen.
- Do not create per-domain journals.
- Do not rewrite migrations already applied to any shared persistent environment without first confirming its migration ledger.
- Before editing migration history, compare the migration ledger on dev/staging and record exactly which of `0038`–`0048` have run.

### D2. Choose the safe path based on environment state

**If the migrations have not reached a shared environment:** regenerate the unshipped tail into ordered release-safe migrations.

**If any have reached dev/staging:** treat them as immutable and add forward migrations; construct production release batches from a clean base and rehearse the exact sequence. Never silently change checksums/content under an applied migration number.

### D3. Ordered release batches

Keep one lineage but deploy in domain-sized batches:

1. **Additive financial foundation:** idempotency/correction/sequence schema without hard data-dependent enforcement.
2. **Financial report and repair:** run per-organization mismatch reports; record all ambiguous decisions; apply only `--fix-safe` automatically.
3. **Financial enforcement:** active uniqueness and relationship guards after the report is clean or every exception has an owned resolution.
4. **Submission and calendar:** additive state tables, producers, then workers/reconciliation.
5. **WhatsApp additive reliability:** recipient/event/lease fields and non-unique indexes; deploy code that understands both old and new rows.
6. **WhatsApp data preparation:** detect duplicate contacts/provider identities; resolve them with an explicit report and reviewed repair.
7. **WhatsApp enforcement:** add uniqueness only after the duplicate report is clean.
8. **Expenses and billing:** backfill/reconcile, compare before/after totals or quantities, then enable canonical readers/writers.

No batch may depend on application code that has not already been deployed compatibly.

### D4. Replace hard-abort surprises with explicit preflight gates

- Keep enforcement migrations fail-closed as a final safety net.
- Move the expected discovery and repair process earlier into executable preflight commands/runbooks.
- Every enforcement migration error must name the exact preflight command or SQL report that exists.
- Do not mention `--fix-approved` as an executable mode unless it is built and tested.
- For ambiguous financial history, the approved decision JSON remains evidence; the actual repair is a reviewed one-off or a future explicitly scoped executor.

### D5. Required rehearsal evidence

For each batch record:

- Starting schema/migration version.
- Row counts and mismatch/duplicate counts before migration.
- Migration duration and lock behavior on sanitized production-size data.
- Before/after financial totals, campaign identities, expense profitability, or seat quantities as relevant.
- Application compatibility during the rolling-deploy window.
- Roll-forward recovery steps; financial history is never deleted as rollback.

### D acceptance gate

- Fresh database migrates successfully.
- Sanitized production-size rehearsal succeeds batch by batch.
- Dirty-data fixtures prove preflight reporting and expected enforcement failure.
- No dirty financial record can block deployment of an unrelated domain batch.
- The runbook references only commands that exist.

## Work package E — Remaining correctness and operations

**Priority:** P1. Finish before declaring the overall remediation complete.

### E1. Booking reference sequence

- Extend the existing document sequence allocator with a `booking` document type if the schema/type does not already expose it.
- Allocate the booking reference in the same transaction that creates the booking.
- Seed the next value from all historical booking references that participate in the visible numbering series, including soft-deleted history where applicable.
- Preserve the current visible prefix/padding format.
- Add a uniqueness constraint only after a duplicate preflight passes.
- Add PostgreSQL concurrency tests proving two simultaneous bookings receive distinct references and rollback does not leave an externally visible duplicate.

### E2. Recurring reconciliation ownership

Use the already deployed scheduler/runtime rather than adding another platform merely because Trigger.dev files exist. One task may invoke several bounded reconcilers, but failures must remain isolated per organization/domain.

Initial cadence and mode:

| Reconciler | Initial cadence | Mode |
| --- | --- | --- |
| WhatsApp webhook replay | Every worker poll | Automatic safe replay |
| WhatsApp expired lease recovery | Every worker poll | Automatic state recovery |
| Calendar reconciliation | Every 15 minutes | Apply safe missing/stale intent repair |
| Subscription seat reconciliation | Hourly | Idempotently converge explicitly seat-based subscriptions |
| Financial mismatch reconciliation | Daily | Report-only; never automatic ambiguous repair |

- Use a database or scheduler-level singleton/overlap guard where concurrent full scans would be wasteful.
- Scope work by organization and bound batch size/runtime.
- Record last success/failure using existing domain reconciliation state where present.
- Provide manual commands using the same services as scheduled execution.
- If Trigger.dev is chosen, confirm it is deployed in every target environment and document ownership; otherwise schedule through the existing worker/cron deployment.

### E3. Documentation truth

- Update [whatsapp-module.md](./whatsapp-module.md): mark autonomous webhook replay and the single campaign path complete only after their tests pass.
- Update [worker-state-contract-inventory.md](./worker-state-contract-inventory.md) with corrected attempt-recovery semantics and webhook event state.
- Update [financial-mismatch-reconciliation.md](./financial-mismatch-reconciliation.md) to say explicitly that the decision file is evidence, not an executable repair instruction.
- Update [core-product-remediation-final-validation.md](./core-product-remediation-final-validation.md) with a new validation date/commit and remove the superseded merge recommendation.
- Document why voided receipt history continues to lock ordinary payment edits and direct users to the correction flow.

### E acceptance gate

- Concurrent booking creation cannot duplicate a reference.
- Every periodic reconciliation has a deployed owner, cadence, overlap policy, manual equivalent, and failure state.
- No plan/runbook claims an unbuilt command or recovery path exists.

## Bounded cleanup — only after the gates

Consolidate the five message-enqueue call sites around one small service that owns:

- tenant/account/contact validation;
- conflict-safe conversation resolution;
- message and outbox creation in one transaction;
- deterministic origin identity (`campaignRecipientId`, `automationActionId`, or API idempotency identity);
- initial message/outbox status values.

Do not hide campaign materialization, webhook event processing, or table-specific worker claims behind a generic repository. Shared backoff calculation, lease-expiry predicates, and transition assertions are acceptable when tests demonstrate identical semantics.

## Implementation and commit sequence

Keep every commit independently reviewable and do not push without explicit approval.

1. `test(whatsapp): expose duplicate campaign execution paths`
2. `fix(whatsapp): route all campaigns through recipient ledger`
3. `test(whatsapp): cover webhook replay and concurrent claims`
4. `fix(whatsapp): add durable webhook event replay`
5. `fix(whatsapp): recover final pre-dispatch outbox attempts`
6. `test(whatsapp): cover final-attempt crash boundaries`
7. `fix(bookings): allocate references transactionally`
8. `feat(operations): schedule domain reconciliation`
9. `refactor(whatsapp): consolidate enqueue state creation`
10. `build(database): stage remediation migrations by release gate`
11. `docs(remediation): publish rollout and correction contracts`
12. `test(remediation): complete adversarial release validation`

Migration work may require moving commit 10 earlier when B or E introduces schema. The rule is still: schema addition first, compatible code second, enforcement only after data preparation.

## Validation matrix

| Level | Required validation |
| --- | --- |
| Focused unit | Campaign state derivation, retry/backoff, attempt restoration, status monotonicity, booking format parsing. |
| PostgreSQL integration | Campaign double execution, webhook double claim/replay, outbox crash boundaries, booking sequence concurrency, enforcement preflights. |
| Worker | WhatsApp full suite, calendar full suite, replay/reconciliation batch isolation. |
| API | Complete `@repo/api` suite, including financial correction immutability. |
| Schema | Fresh `0000` to head migration, generated-schema drift check, dirty-data enforcement fixtures. |
| Monorepo | Type-check, changed-file Biome, `git diff --check`, production build. |
| Staging | Authenticated send-now and scheduled campaigns, webhook failure/replay, delivery/read counters, provider-unknown handling, booking concurrency smoke, scheduled reconciliation evidence. |
| Production rehearsal | Sanitized production-size, batch-by-batch migrations, before/after reports, timing/lock evidence. |

## Final release gates

Production remains blocked until all are true:

- One WhatsApp campaign execution path; legacy sender absent.
- Failed webhook events recover without provider redelivery.
- Final-attempt pre-dispatch crashes remain retryable; post-dispatch uncertainty is quarantined.
- Migration batches have been rehearsed against representative data.
- Financial and WhatsApp enforcement preflights are clean or every exception has a documented owner and resolution.
- Booking references allocate transactionally.
- Calendar, seat, webhook, outbox, and financial reconciliation have explicit deployed schedules or worker ownership.
- Full validation matrix passes and the final validation document is refreshed.

Payment, invoice, submission, expense, billing, and calendar code that already passed adversarial review should not be redesigned while completing these gates. Changes in those domains require a failing regression, a rollout compatibility need, or a separately approved product decision.
