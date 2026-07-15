# Core Product Remediation — Safe Execution Specification

> **Read when:** implementing, reviewing, releasing, or operating any remaining work on `codex/core-product-remediation`.
>
> **Status:** canonical execution specification; implementation not yet complete.
>
> **Accountable:** Rakesh. When one person fills engineering, product, finance, and operations roles, every exceptional decision must record evidence, alternatives, reasoning, and consequences.
>
> **Authority:** this file is the single source of truth for remaining scope, order, acceptance, and rollout. Earlier plans are evidence and history; when they conflict with this file, this file wins.

## 1. Plain-language outcome

The branch began as a deep review of the product logic where incorrect behavior can lose money, corrupt history, duplicate customer messages, or leave work stuck. It already contains substantial fixes across payments, invoices, submissions, Calendar delivery, WhatsApp, expenses, billing, and reconciliation.

The remaining job is smaller than the branch, but still sensitive:

1. Make manual WhatsApp sends durable and safe when an API request, Trigger.dev call, worker, or provider response fails at an awkward moment.
2. Close four financial edge cases without weakening financial-history protection.
3. Make multi-assignee submission review reflect the whole assignment, not whichever person was reviewed first.
4. Make Calendar cancellation survive reassignment and deletion without duplicate or guessed provider effects.
5. Reconstruct an actually deployable migration/release sequence after checking the real migration history of every shared database.

We will implement and validate these one package at a time. Completing this branch does **not** authorize a production data repair, migration, provider send, push, merge, or deployment.

## 2. Relationship to earlier documents

- [Original remediation plan](./core-product-remediation.md): original domain review and implemented architecture.
- [Adversarial follow-up](./core-product-remediation-adversarial-followup.md): disposition of the first adversarial review and fixes already delivered.
- [Final validation](./core-product-remediation-final-validation.md): useful clean-database baseline, not proof that the branch is safe for current production data.
- [Rollout notes](./core-product-remediation-rollout.md): earlier rollout intent; superseded where its current migration slicing is not executable.
- [Financial mismatch model](./financial-mismatch-reconciliation.md), [WhatsApp product direction](./whatsapp-module.md), and [worker contracts](./worker-state-contract-inventory.md): supporting domain contracts.
- `/Users/rakesh/.claude/plans/polished-toasting-tower.md`: review input only, not an execution plan.

No new broad audit is part of this specification. New evidence may change a local implementation, but expanding scope requires a recorded decision.

Accepted completed baseline, retained behind regression tests rather than redesigned: atomic/idempotent payment creation and conversion; reversal-based payment correction and financial locks; document sequencing and mismatch reporting; reviewer claim fencing; durable Calendar intents; deletion of the legacy WhatsApp campaign sender; recipient-ledger campaign completion; webhook replay; pre-dispatch outbox-attempt recovery; contact ownership enforcement; booking-number allocation; scheduled reconciliation; canonical expense profitability; and seat reconciliation.

## 3. Baseline freeze and safety boundary

At execution start, record:

- branch and exact commit; current expected baseline is `codex/core-product-remediation` at `caa3e921`;
- `git status --short`, excluding the unrelated existing `apps/handbook/next-env.d.ts` change;
- runtime/database tool versions, latest migration/journal entry, and test URLs proving none point to production.

The earlier baseline passed fresh migrations through `0051`, schema-drift generation, 298 API tests, worker/script suites, monorepo type-check, Trigger.dev dry run, and the web build. Treat that as regression evidence only. It says nothing about dirty historical rows, database size, lock duration, provider credentials, or rolling-deploy compatibility.

### Hard safety rules

- Never run tests, repair commands, schema generation, or migration rehearsal against production, and never rewrite a migration that ran in a shared persistent database.
- Never auto-repair an ambiguous financial or identity mismatch or edit/delete issued financial history to make a constraint pass.
- Never automatically resend after the provider may have accepted a message or Calendar effect.
- Never deploy this integration branch wholesale.
- Take one work package through implementation, adversarial review, tests, and a focused commit before starting the next.
- Push, PR, merge, staging write, privileged production read, production write, migration, and deployment each need explicit Rakesh approval at that point.

## 4. Product invariants

These decisions are fixed unless a separate ADR or product decision explicitly replaces them.

### Money

- A committed financial operation is complete, or none of its business effects exist. A repeated request with the same idempotency key and payload returns the original result; a different payload cannot reuse that key.
- Active or voided receipts remain financial history. Ordinary payment edits/deletion stay blocked; correction uses reversal and replacement.
- Invoice, schedule, payment, receipt, booking, and organization relationships agree in both directions. Document numbers are unique, monotonic per defined scope, and never allocated with `MAX + 1` races.
- Reconciliation may repair only deterministic cached/projection state; history or ambiguous ownership requires an explicit decision.

### WhatsApp

- The database is the durable queue. Trigger.dev may wake a worker sooner, but Trigger failure cannot erase committed work. One user intent creates at most one durable message/outbox effect.
- A provider call never occurs inside a database transaction.
- `dispatchStartedAt` is the point after which a crash means `delivery_unknown`, not automatic retry. Late provider identity/status evidence is retained and applied monotonically.
- Campaign recipient rows are the campaign truth; the API never runs a competing send path.

### Submissions

- A submission decision is reviewer-owned and organization-scoped. Parent task/deliverable state is derived from all current assignees, not one submission in isolation.
- Concurrent decisions cannot overwrite a newer aggregate result.

### Calendar

- Cancellation work is never discarded merely because a newer delivery generation exists. Stored immutable identity survives crew/shoot assignment changes.
- Unknown provider outcome or insufficient historical identity is visible and terminal/manual; the system does not guess or loop forever.
- Keep the existing advisory transaction lock across provider delivery for now. A provider-specific redesign requires a separate ADR because ICS email is not idempotent.

## 5. Fixed execution order

| Order | Package | Severity | Why it comes here |
| --- | --- | --- | --- |
| 0 | Baseline and migration-ledger discovery | Release gate | Prevents unsafe migration rewriting before code work changes schema assumptions. |
| 1 | Manual WhatsApp durability and idempotency | P0 | Customer-visible duplicates/loss; defines any additive schema needed later. |
| 2 | WhatsApp late acceptance and campaign fairness | P0/P1 | Closes uncertain-send loss and scheduling starvation on the same runtime. |
| 3 | Financial sequence and relationship edges | P0/P1 | Protects money and numbering; bounded changes on established services. |
| 4 | Multi-assignee submission aggregation | P1 | Correctness fix with a contained state model. |
| 5 | Calendar stale cancellation convergence | P1 | External effects need deliberate legacy handling. |
| 6 | Migration-tail reconstruction | Release gate | Only safe after schema requirements and real ledgers are known. |
| 7 | Full validation and release-batch rehearsal | Release gate | Proves code locally and release mechanics on representative data. |

Do not combine packages 1–5 into one commit. Do not start package 6 until package schemas are final.

## 6. Package 0 — Baseline and real migration-ledger discovery

### Problem

The branch has one development migration tail, `0038`–`0051`, spanning several domains. Its file order does not match the desired release order: some enforcement appears before later additive state, and `0046` combines WhatsApp additive and enforcement concerns. “Cherry-pick a migration slice” is therefore not a real deployment method.

### Required work

1. Freeze the code baseline described in section 3.
2. With separately approved read-only access, read `__drizzle_migrations` from development, staging, and production. Record the known application commit, latest migration, applied timestamps, and hashes/checksums or equivalent evidence.
3. Compare applied files with repository copies where the ledger permits it, then write sanitized evidence under `docs/plans/evidence/`.
4. Classify the migration strategy:
   - **Unapplied tail:** none of `0038`–`0051` ran in a shared persistent environment; a new consecutive tail from `main` may be generated.
   - **Applied tail:** any entry ran in a shared persistent environment; preserve that history and use forward bridge migrations.
   - **Unknown:** evidence unavailable; migration edits remain blocked, while schema-neutral packages may continue.

### Acceptance

- No migration file is edited in this package.
- The evidence identifies every shared environment or names missing access; strategy comes from observed ledger state, not Git assumptions.
- Production access is read-only and separately approved by Rakesh.

**Commit boundary:** `docs(database): record shared migration lineage` after approved, sanitized evidence exists. If access is unavailable, record the blocker locally and do not fabricate a commit claiming completion.

## 7. Package 1 — Manual WhatsApp durability and idempotency

### Problem

Manual text, template, and media procedures currently create related message, activity, and outbox rows through separate database operations. A middle failure can leave partial state. After durable rows exist, `triggerWhatsAppOutbox` can fail and make the API look unsuccessful even though the database poller can still send; a client retry can then create a second message.

### Contract

- Manual send requires a client idempotency key and canonical request fingerprint.
- Claim, message, activity, and outbox creation commit in one transaction.
- Same organization + actor/scope + key + same fingerprint replays the original accepted result.
- Same key + different fingerprint returns a deterministic conflict.
- Trigger.dev enqueue happens only after commit and is best-effort. Its failure is recorded/logged but the API still reports the durable database acceptance.
- The worker poller remains sufficient to deliver every accepted outbox row.

### Implementation

1. Inspect and unify `packages/api/modules/whatsapp/procedures/send-text.ts`, `send-template.ts`, and `send-media.ts` behind one transactional manual-send service.
2. Add a narrow idempotency table/fields under `packages/whatsapp-db/drizzle/schema/` only if no existing durable claim can represent this operation, while keeping generated deployment SQL in the sole `packages/database` migration lineage. Store organization, scoped key, fingerprint, state, resulting message/outbox IDs, and timestamps.
3. Hash a canonical semantic payload: exclude transport-only noise; include destination/contact, WhatsApp account, message kind, content/template/media identity, and anything else that changes the send.
4. Insert/claim the idempotency record and all business rows through the same transaction client; never call global `db` inside it.
5. Return the stored original response for completed duplicate requests. Handle concurrent claim conflict without creating a second effect.
6. Make `packages/api/modules/whatsapp/lib/trigger-outbox.ts` a post-commit wake-up helper that cannot mark durable rows failed because Trigger.dev is unavailable.
7. Keep dispatch in `packages/whatsapp-outbox`; update the web caller/key store if needed so retry keeps the key while an edited payload gets a new one.

### Tests

- Each send kind commits message + activity + outbox + idempotency result together; forced failure at every insert boundary rolls it all back.
- Identical sequential/concurrent retries and API-response loss create one effect and return the same IDs; changed-payload key reuse conflicts.
- Trigger.dev failure after commit still returns durable acceptance and the poller sends once.
- Cross-organization/account key reuse cannot leak or replay another result.

### Acceptance and compatibility

- No manual send procedure independently assembles the durable rows.
- Every accepted API result points to an outbox row eligible for polling.
- Old clients need a compatibility window or coordinated web/API release. If the key becomes required, deploy the updated first-party client before enforcing it for all callers.
- Additive schema must tolerate old application code during the rolling window.

**Commit boundary:** `fix(whatsapp): make manual sends durably idempotent`.

## 8. Package 2 — Late provider acceptance and campaign fairness

### 8.1 Late provider acceptance

#### Problem

After a lease expires, recovery can move an outbox item to `delivery_unknown`. If the original worker then receives provider success, its owner-fenced success update no longer matches. The subsequent fallback can also no-op, losing the provider message ID that later webhooks need.

#### Contract and implementation

- Preserve owner fencing for normal `processing → sent` completion.
- Add a conditional late-acceptance transition in `packages/whatsapp-outbox/outbox-processor.ts` that attaches provider evidence to the same `delivery_unknown` dispatch, proven by immutable dispatch token/generation rather than stale worker ID.
- Never turn late acceptance into an automatic resend.
- Let `packages/whatsapp-runtime/webhook-event-runtime.ts` resolve stored status events when identity becomes known; remain idempotent/monotonic, and treat conflicting identity as manual-reconciliation evidence.

#### Tests

- Pre-dispatch expiry restores a retry; post-dispatch expiry becomes `delivery_unknown`.
- Late success stores identity once, concurrent recovery converges, and stored webhooks reconcile.
- Conflicting IDs surface conflict without resend; repeated late callbacks/webhooks become no-ops.

**Commit boundary:** `fix(whatsapp): reconcile late provider acceptance`.

### 8.2 Campaign fairness and lifecycle

#### Problem

`processDueWhatsAppCampaigns` can repeatedly select running campaigns alongside scheduled campaigns under a small limit. Long-running work can starve newly due campaigns. Retry entry can also overwrite `startedAt` or revive a campaign that became terminal. The `client` audience filter currently behaves like “not crew,” which is broader than “has a client contact.”

#### Contract and implementation

- Select newly due campaigns and running campaigns with pending enqueue recovery as distinct queues or a fair deterministic order. Running status alone is not eligibility.
- Claim with conditional state/generation fencing so two workers cannot revive or duplicate it.
- Set `startedAt` only on the first valid transition into running; stale workers cannot overwrite it or revive terminal campaigns.
- `contactType = client` requires the real client-contact relationship; it is not the negation of crew.
- Preserve the `dev` WhatsApp product direction while keeping the recipient ledger as the sole sender.

#### Tests

- Running campaigns beyond the batch limit cannot starve newly due work; ordering is stable and only pending enqueue work is revisited.
- Concurrent workers materialize one frozen audience/effect per recipient; `startedAt` and terminal state remain immutable.
- Client, crew, dual-role, and neither-role contacts match the correct filters.

**Commit boundary:** `fix(whatsapp): prevent campaign scheduling starvation`.

## 9. Package 3 — Financial sequence and relationship edges

The four slices below share financial invariants but remain separate commits and tests.

### 9.1 Self-healing document sequence drift

**Problem:** receipt insertion retries inside a savepoint, but a sequence increment in that same savepoint rolls back after a number conflict. Retrying can allocate the identical conflicting number forever.

**Implementation:** extend `packages/api/modules/financial-documents/lib/document-number-service.ts` with a transaction-safe “advance sequence floor above observed historical number” operation. Perform floor repair outside the rolled-back insertion savepoint, then allocate again. Reuse for receipt, invoice, and booking. Retry only the exact document-number unique index; unrelated `23505` errors surface immediately.

**Tests:** stale sequence versus active and soft-deleted history; concurrent floor repair; exact index classification including wrapped driver errors; unrelated uniqueness failure; bounded retries.

**Acceptance:** no infinite same-number loop, no number reuse, and sequence repair never changes issued documents.

**Commit boundary:** `fix(finance): self-heal document sequence drift`.

### 9.2 Enforce invoice/schedule closure

**Problem:** an invoice-linked payment may omit the schedule already linked to that invoice. The invoice changes while schedule totals do not, creating asymmetric truth.

**Implementation:** in the received-payment creation/conversion/correction services, load and lock canonical invoice/schedule relationships from the database in the established lock order. Derive a missing linked side when unambiguous. Reject an explicitly supplied relationship that disagrees. Apply payment, invoice, schedule, receipt, and booking effects atomically. Put the rule in the service layer and database enforcement where feasible; procedures must not duplicate it.

**Tests:** invoice only with linked schedule derives schedule; schedule only with linked invoice derives invoice; explicit mismatch rejects without effects; unlinked invoice remains valid; concurrent relationship/payment changes serialize; cross-org/booking combinations reject.

**Commit boundary:** `fix(payments): enforce invoice schedule closure`.

### 9.3 Preserve schedule completion history during correction

**Problem:** correcting a payment can replace a historically correct schedule `paidAt` with the correction time even when the schedule never left the completed state.

**Implementation:** calculate the schedule state before and after the atomic correction. If the completion boundary remains continuously satisfied, preserve the prior `paidAt`. If the schedule leaves completion, clear it. If it newly enters completion, derive the timestamp from the active payment history/product rule, not automatically from `reversedAt`.

**Tests:** completed→completed preserves timestamp; completed→partial clears; partial→completed sets correct timestamp; multiple active payments; same transaction rollback; repeated correction request is idempotent.

**Commit boundary:** `fix(payments): preserve schedule completion history`.

### 9.4 Protect terminal invoices in reconciliation

**Problem:** overdue projection and `--fix-safe` can treat cancelled or draft invoices like collectible invoices and mutate their cached status.

**Implementation:** define collectible invoice states once and use them in both mismatch reporting and safe repair. Draft, cancelled, voided, or other terminal/non-collectible states never become overdue. Report historical inconsistency if useful, but do not auto-change terminal history.

**Tests:** due draft/cancelled/finalized-paid/finalized-unpaid combinations; report and `--fix-safe` share the same expected status; second safe-fix run is a no-op.

**Commit boundary:** `fix(finance): protect terminal invoices in reconciliation`.

## 10. Package 4 — Multi-assignee submission aggregation

### Problem

The first reviewer decision currently moves the parent task/deliverable directly to approved or revision requested. A sibling’s later decision can then fail because the parent is no longer in a reviewable state. The parent is reflecting one submission, not the assignment as a whole.

### Canonical aggregate rule

Relevant people are the current `taskAssignments` or `deliverableAssignments`. For each current assignee, use that assignee’s latest submission for the parent.

| Evidence across current assignees | Parent state |
| --- | --- |
| No current assignments | `not_started` |
| Assignments exist; no submissions | `assigned` |
| Every assignee’s latest submission is approved | `approved` |
| Any latest submission is revision-requested/rejected | `revision_requested` |
| Otherwise any latest submission is in review | `in_review` |
| Otherwise any latest submission is submitted | `submitted` |
| Remaining assigned assignees have no submission | `assigned` only when no assignee has progressed further |

An assignee with no submission prevents approval. Revision state has precedence because work remains. A later resubmission replaces that assignee’s prior decision for aggregation but never deletes the decision history.

### Implementation

1. Extract one aggregate helper/service beside `packages/api/modules/submissions/lib/review-decision-service.ts`.
2. In every decision transaction, lock the parent first, then assignment/submission rows deterministically; store the decision, recompute, and conditionally update the parent atomically.
3. Apply the same recompute after claim/release/resubmission and assignment add/remove wherever those operations can change aggregate state.
4. Set `completedAt`/`deliveredAt` only on transition into approved; preserve while approved and clear if later evidence reopens the parent.
5. Emit individual decision activity, and parent transition only when aggregate state changes; keep organization scoping in every read/lock/update.

### Tests

- Two assignees approve in either order; parent approves only after both, never while one has not submitted.
- Revision beats sibling approval; resubmission and later approval converge correctly.
- Concurrent sibling decisions serialize; adding/removing assignments recomputes and can reopen approval.
- Task/deliverable paths behave identically, including timestamps and notifications.

### Acceptance

- No valid sibling decision is rejected merely because an earlier sibling changed the parent.
- One shared aggregate rule owns parent state.
- Re-running aggregation without changed evidence is a no-op.

**Commit boundary:** `fix(submissions): aggregate parent review state`.

## 11. Package 5 — Calendar stale cancellation convergence

### Problem

`supersedeUnstartedGenerations` currently completes non-processing jobs broadly, which can erase pending cancellation. After crew/shoot deletion or unassignment, active-target lookup can disappear even though an external Google event or ICS invitation still needs cancellation. Legacy rows may lack enough immutable identity to perform cleanup safely.

### Contract

- New delivery intent supersedes stale create/update work, never outstanding cancellation work.
- Cancellation uses the immutable identity captured when delivery occurred, not the current assignment lookup.
- A replacement delivery waits until prior cancellation is terminal.
- Reconciliation converges: a second run with unchanged evidence produces no new job/effect.

### Legacy evidence matrix

| Stored evidence | Result |
| --- | --- |
| No evidence an external effect existed | Complete cancellation as a no-op with reason. |
| Google connection/identity plus calendar and event IDs | Cancel using stored identity; record provider result idempotently. |
| ICS recipient plus UID/sequence | Send the correct cancellation under the existing fenced worker contract. |
| Evidence of an effect but insufficient cancellation identity | Terminal `manual_reconciliation`/equivalent with evidence; no guess and no infinite retry. |
| Provider outcome uncertain | Preserve uncertain/manual state; do not create replacement delivery automatically. |

### Implementation

1. Narrow `packages/api/modules/shoots/lib/calendar-intent-persistence.ts::supersedeUnstartedGenerations` to supersedable create/update generations only.
2. Persist immutable Google/ICS identity before provider effect; cancellation prefers that snapshot while active crew/shoot lookup is enrichment only.
3. Add an explicit terminal/manual-reconciliation representation if current state cannot express insufficient evidence.
4. Fence new delivery on unresolved cancellation; keep the advisory transaction lock across provider calls and do not broaden this into a queue redesign.
5. Make reconciliation create only missing actionable work and preserve terminal evidence.

### Tests

- Pending cancellation survives newer generation/reassignment; deleted crew/shoot and removed assignments cancel from stored identity.
- Every legacy evidence-matrix row reaches the specified terminal outcome.
- Concurrent workers/reconciliation create one effect; replacement waits for cancellation and remains blocked for uncertain/manual outcome.
- A second unchanged reconciliation run is a no-op.

### Acceptance

- No cancellation is marked complete merely because current target data vanished.
- No incomplete historical row retries forever.
- No provider cleanup uses guessed account, event, recipient, or UID identity.

**Commit boundaries:** `fix(calendar): preserve stale cancellation work`, then `fix(calendar): converge legacy cleanup safely` if the schema/state matrix warrants two reviewable slices.

## 12. Package 6 — Reconstruct a release-safe migration tail

Start only after package 0 has a ledger classification and packages 1–5 have final schema requirements.

### Strategy A — tail unapplied everywhere shared

1. Branch from `main` for the first release batch.
2. Regenerate a consecutive Drizzle tail in dependency order without hand-editing snapshots/journal metadata; separate additive schema, report/backfill, and enforcement.
3. Build each later release branch on the previously released batch, cherry-picking reviewed domain commits—not arbitrary SQL files.
4. Prove a fresh database and a representative upgraded database produce the same final schema.

### Strategy B — tail applied in any shared database

1. Keep every applied SQL file, snapshot, journal entry, and hash immutable.
2. Add forward bridge migrations to make the shared lineage compatible with the desired end state.
3. Reset disposable environments only with approval, never shared data; production receives the exact rehearsed forward sequence, including unavoidable combined dependencies.

### Required release batches

1. Payment/invoice additive state plus backward-compatible application code.
2. Financial report and reviewed repair, then financial enforcement.
3. Submission and Calendar state/producers/workers.
4. WhatsApp additive reliability plus compatible API/worker.
5. WhatsApp identity report/cleanup, then ownership/uniqueness enforcement.
6. Expenses and billing canonicalization/reconciliation.

Each batch must have its own branch/PR, preflight, migration set, compatibility proof, rehearsal record, deploy checklist, and roll-forward response. Do not deploy the integration branch.

### Enforcement rules

- Report first; enforcement second.
- Hard-abort constraints remain final safety nets, not the first time dirty data is discovered.
- Every abort message names an existing report/preflight command.
- `--fix-safe` touches only taxonomy-safe projection/cache mismatches.
- There is no implied `--fix-approved`. Ambiguous fixes are reviewed one-off migrations/scripts with evidence and backups.

**Commit boundary:** chosen after package 0. Expected form: `build(database): reconstruct release-safe migration tail` for an unapplied tail, or focused forward-migration commits for an applied tail.

## 13. Package 7 — Validation and release rehearsal

### Per-commit gate

Before each commit:

1. Inspect `git status` and the full focused diff; exclude unrelated user changes.
2. Review adversarially for duplicate execution, partial failure, stale ownership, cross-org access, out-of-order events, and retries; reject if an invariant lacks a test or an error path leaves ambiguous state.
3. Run focused unit and PostgreSQL integration tests for the package.
4. Run changed-file Biome and `git diff --check`.
5. Commit only the reviewed slice with its specified Conventional Commit message.

### Full local gate

Use an isolated, disposable PostgreSQL database and reproduce at least:

```bash
pnpm --filter @repo/database exec drizzle-kit migrate --config=drizzle.config.ts
NODE_OPTIONS=--max-old-space-size=6144 pnpm typecheck
pnpm --filter @repo/api test
pnpm --filter @repo/whatsapp-worker test
pnpm --filter @repo/calendar-worker test
pnpm --filter @repo/scripts test
pnpm --filter @repo/auth exec vitest run lib/organization-seat-sync.test.ts
NODE_OPTIONS=--max-old-space-size=6144 pnpm build
pnpm whatsapp:migration-preflight
pnpm financial:migration-preflight
```

Also run the changed web helper tests, Trigger.dev dry-run build, schema-drift generation, and focused concurrency/failure-injection suites introduced by this specification. Repository-wide `pnpm check` has known starter debt; record its baseline and require **no new diagnostics in changed files**, not a fake all-green claim.

### Representative-data rehearsal per release batch

On a recent sanitized production-size copy:

- Restore backup; record starting ledger/application commit; run report-only preflights and retain sanitized output.
- Measure migration duration/locks and compare relevant row counts, totals, document/message identities, and projections before/after.
- Test old-app/new-schema and new-app/old-additive-schema compatibility during the rolling window.
- Execute a failed rehearsal to prove roll-forward, then restore and run the exact final batch cleanly.

### Staging external-effect gate

With test organizations, contacts, calendars, provider accounts, and explicit approval:

- manual WhatsApp API timeout/retry, Trigger failure, worker crash, late provider acceptance, webhook replay, and campaign fairness;
- payment create/replay/correction plus linked invoice/schedule behavior and historical timestamps;
- two-assignee submission decisions/resubmission in both orders;
- Google and ICS create/update/cancel across unassign/delete and repeated reconciliation.

Use non-customer destinations. Record provider IDs and verify exactly-once database effects. No staging acceptance action targets a real customer by convenience.

## 14. Shipping procedure for real users and databases

For each release batch:

1. Prepare the domain branch from the last released production commit/batch.
2. Include only reviewed code, compatible migrations, tests, preflight, and runbook; pass local gates and sanitized rehearsal.
3. Obtain explicit Rakesh approval to push and open the PR.
4. Review PR/CI; do not merge while required gates are skipped or red.
5. Verify a recoverable production backup, then run read-only preflight; stop on unexpected counts, ambiguity, ledger mismatch, or unrehearsed lock risk.
6. Obtain explicit approval for reviewed data repair and retain its decision record.
7. Deploy compatible code/additive migration in rehearsed order; enforce only after data is clean and compatible code is live.
8. Run smoke/reconciliation comparisons before the next batch; on failure stop new effects and roll forward without deleting history or guessing provider identity.

There is no “merge everything, then see.” A successful batch reduces risk before the next one begins.

## 15. Decision record for unexpected real data

Create one sanitized record per unresolved class:

```markdown
# Decision: <class and date>

- Environment and read-only query/report version:
- Affected organizations/row counts (no customer PII):
- Invariant violated:
- Evidence and likely origin:
- Options considered:
- Chosen correction and why:
- Rows/financial totals/provider identities expected before and after:
- Reviewer/accountable person:
- Backup and roll-forward plan:
- Verification result:
```

If the evidence does not identify one unambiguous correction, stop. Product/finance judgment is required; automation is not a substitute.

## 16. Explicit non-goals

- Rate limiting, broad observability, Sentry, generic operational tooling, or starter-template/lint-debt cleanup.
- Generic queue library, central jobs table, repo-wide worker rewrite, or consolidating every lease implementation without a separate ADR.
- Broad Calendar provider redesign or moving external calls outside the current lock contract.
- Unlocking voided-receipt history, unrelated UI/package modernization, or dependency churn.
- Pushing, merging, deploying, or running production repairs as an implied part of implementation.

## 17. Definition of done

### Code-complete on the integration branch

- Packages 0–5 meet their acceptance criteria and are committed separately.
- Package 6 has a ledger-backed migration strategy and executable release artifacts.
- Focused and full local gates pass with no new changed-file diagnostics.
- Final validation document names the exact HEAD, commands, results, skipped external gates, and remaining risks.
- No legacy/duplicate product path bypasses the fixed services.

### Release-complete

- Every batch has passed sanitized production-size rehearsal and authenticated staging acceptance.
- Production ledger and preflight match the rehearsal assumptions.
- Required ambiguous data decisions are resolved with evidence and backup.
- Batches are deployed sequentially with post-deploy reconciliation and comparison.
- No P0/P1 invariant in this specification remains open.

Until both lists are true, describe the work precisely as **code-complete but not production-released**, or **partially released through batch N**. Never call a clean local database proof of production safety.
