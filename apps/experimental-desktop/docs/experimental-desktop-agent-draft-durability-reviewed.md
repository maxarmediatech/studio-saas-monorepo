# Experimental Desktop Agent Draft Durability - Implementation Plan

Final reviewed implementation plan for robust desktop agent composer/session persistence.

Read when: implementing, revising, or approving draft durability for `apps/experimental-desktop` composer, draft routes, conversation promotion, queueing, approvals, or local persistence. This document supersedes `docs/plans/experimental-desktop-agent-draft-durability.md`; implement from this plan.

## Final Decision

Use SQLite-backed, target-keyed, versioned composer drafts with hydrate-before-autosave and explicit promotion.

Non-negotiable production fixes:

- Promotion must be atomic/idempotent.
- Existing promoted rows must be backfilled during migration.
- Draft id namespaces must not collide.
- Conversation follow-up clears hard-delete the draft row.
- Shared parser/types must live under `src/shared`, not renderer component paths.
- Queue hydration needs an explicit API and restart recovery.
- Pending approval answer drafts must not clear with normal composer input.

Implementation priority:

1. Atomic promotion transaction.
2. Migration backfill.
3. Shared parser/types under `src/shared`.
4. New composer-draft IPC endpoints; route drafts never call random `createDraft`.
5. Target-aware hydrate/flush hook.
6. Conversation follow-up draft persistence.
7. Queue hydration/recovery.
8. Attachment sanitization.
9. Pending approval answer draft isolation.

## Keep

Keep these core decisions: route draft id equals `drafts.id`; conversation follow-up drafts are durable and scoped; draft identity stays separate from conversation identity; old random `createDraft()` is compatibility only; autosave exposes `flush()`; hydration precedes persistence; parse failure is recoverable; promotion is a DB lifecycle; queue UX survives route switches and restart; approval answer drafts survive route switches/remounts while their approval is live; SQLite remains the production store.

## Required Changes

### P0 - Promotion Must Be Atomic And Idempotent

Problem: the current lifecycle still allows partial writes. A crash or retry between `markDraftPromoting`, conversation creation, admitted request recording, and final status can create duplicate conversations or lose the admitted audit link.

Required change:

- Replace scattered promotion writes with one main-process repository transaction.
- Transaction validates draft target/status, records or verifies admitted request id, creates conversation/session/turn/messages, records admitted request with `draft_id`, `conversation_id`, and `turn_id`, sets `drafts.status = 'promoted'`, sets `promoted_conversation_id`, and returns the existing conversation for safe replay.

Suggested API:

```ts
promoteDraftWithAdmittedRequest(input: {
  draftId: string;
  request: ValidatedAdmittedComposerRequest;
  cwd: string;
  ids: PromotionIds;
  now: string;
}): {
  conversationId: string;
  providerSessionId: string;
  turnId: string;
  userMessageId: string;
  assistantMessageId: string;
  idempotentReplay: boolean;
};
```

Rules:

- `promoted` plus `promoted_conversation_id` returns existing conversation.
- Same admitted request id and same content returns existing mapping.
- Same admitted request id with different content fails loudly.
- `discarded` rejects unless there is an explicit restore action.
- Renderer never generates conversation, provider session, turn, or message ids.
- Controller/main generates `PromotionIds` once inside the promotion command.
- Repository owns the DB transaction and does not accept renderer-generated promotion ids.
- Primary idempotency key is `draftId + status + promoted_conversation_id`.
- Same admitted request id is an extra replay/content guard, not the only replay mechanism.
- Renderer state is never the idempotency authority.

Tests: same-request retry, different-request retry, promoted route recovery, crash-before-conversation recovery, crash-after-conversation repair.

### P0 - Migration Must Backfill Existing Promoted Drafts

Problem: adding `status TEXT NOT NULL DEFAULT 'active'` marks every old row active, including rows with `promoted_conversation_id`.

Required migration:

```sql
ALTER TABLE drafts ADD COLUMN version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE drafts ADD COLUMN mode TEXT NOT NULL DEFAULT 'ask';
ALTER TABLE drafts ADD COLUMN conversation_id TEXT REFERENCES conversations(id) ON DELETE CASCADE;
ALTER TABLE drafts ADD COLUMN scope_key TEXT;
ALTER TABLE drafts ADD COLUMN status TEXT NOT NULL DEFAULT 'active'
  CHECK (status IN ('active', 'promoting', 'promoted', 'discarded'));
ALTER TABLE drafts ADD COLUMN last_restored_at TEXT;
ALTER TABLE drafts ADD COLUMN last_error TEXT;

UPDATE drafts
SET status = 'promoted'
WHERE promoted_conversation_id IS NOT NULL;
```

Add migration id, likely `0007_composer_draft_targets`, plus tests for pre-migration active and promoted rows. Do not rely on defaults alone.

### P0 - Define Canonical Storage Source Of Truth

Problem: the plan adds columns and a v2 envelope but does not say which wins when they disagree.

Required decision:

- `payload_json` stores the versioned envelope.
- Top-level columns are query/lifecycle/compatibility mirrors derived from the envelope.
- On write, parse the envelope first and derive columns.
- On read, lifecycle columns win for `status` and promotion; parsed envelope wins for composer content.
- If envelope is missing or v1, rebuild from columns plus old payload.
- If envelope and columns conflict, log a warning code and recover deterministically.

### P1 - Reserve Draft Id Namespaces

Problem: route ids and synthetic ids share `drafts.id`. `/draft/composer:conversation:abc` can collide with `composer:conversation:<conversationId>`.

Required rules:

- New route draft ids are UUID strings only.
- Reserve internal prefixes: `composer:`, `conversation:`, `capture:`.
- Main rejects reserved prefixes for route draft ids.
- `ComposerTarget` parser enforces non-empty id, max length, and allowed format.

Tests: valid route UUID persists exactly; reserved prefix route id rejects; synthetic conversation draft id cannot be opened as a route draft.

### P1 - Conversation Draft Clear Must Not Block Reuse

Problem: conversation follow-up drafts use fixed id `composer:conversation:<conversationId>`. If clear marks that row `discarded`, the primary key blocks the next follow-up unless upsert reactivates it.

Required decision:

- Conversation follow-up drafts are not audit records.
- On successful send or successful queue admission, clear hard-deletes the conversation draft row.
- The admitted request snapshot is the audit trail.
- Next typing recreates the same fixed id `composer:conversation:<conversationId>`.
- Do not mark conversation follow-up drafts `discarded`.

Tests: send follow-up clears; typing a second follow-up persists; queue success clears input only.

### P1 - Shared Parser Must Not Import Renderer Component Types

Problem: `ComposerMode`, `ComposerPayload`, `ComposerContextItem`, and `ComposerAttachment` currently live under renderer component paths. A shared parser used by main/preload cannot depend on renderer modules.

Required files:

```txt
apps/experimental-desktop/src/shared/composer-target.ts
apps/experimental-desktop/src/shared/composer-types.ts
apps/experimental-desktop/src/shared/composer-payload.ts
apps/experimental-desktop/src/shared/composer-draft-envelope.ts
apps/experimental-desktop/src/shared/runtime-mode.ts
```

Rules: no React, no renderer component imports, no Electron imports in `src/shared`. Main, preload, and renderer import plain types/parsers from shared.

### P1 - Cut Over Legacy Draft APIs

Problem: old `draft:create` creates random ids when no `draftId` exists. That is the core route-draft mismatch.

Required change:

- Add new composer draft IPC endpoints and move route-owned composer code to them.
- Mark `draft:create`/`draft:update` legacy or remove after cutover.
- Ensure `/draft/:id` never persists via random `createDraft`.

Suggested endpoints:

```txt
composer-draft:load
composer-draft:upsert
composer-draft:clear
composer-draft:restore-promoted
conversation:promote-composer-draft
conversation:list-queue-items
```

### P1 - Add Stale Hydrate And Flush Guards

Problem: hydrate-before-autosave is right, but races need explicit guards.

Required hook behavior:

- Track `targetKey` and hydrate generation.
- Ignore hydrate results for old targets.
- Flush old target before switching.
- Surface flush failure; do not silently drop content.
- Suppress autosave after successful clear, so reset does not recreate an empty draft.
- Store last persisted key/revision per target.

Tests: slow draft A hydrate cannot overwrite draft B; target switch flushes old target; send clear does not recreate empty row; failed flush preserves visible content.

### P1 - Treat `beforeunload` As Best Effort

Problem: async Electron IPC may not finish during unload.

Required wording:

- `beforeunload` flush is best effort only.
- Real durability comes from debounce, blur, route transition, unmount, send start, and queue start.
- Do not claim restart safety depends on unload alone.

### P1 - Separate Normal Input From Pending Approval Answers

Problem: `pendingRequestAnswerDrafts` belongs in the envelope, but it must not clear with normal composer input.

Scope:

- P1: pending answer drafts survive route switches, component remounts, and renderer state resets while the approval is still live.
- P2 / separate decision: pending answer drafts survive app restart only if approvals themselves become restart-recoverable. Current startup recovery expires pending approvals and marks active/waiting conversations failed, so restart-durable answer drafts alone would not restore a usable approval flow.
- Pending approval answer drafts are stored only on the `conversation` composer target, never on `/draft/$draftId` route targets.

Required shape:

```ts
type ComposerDraftEnvelopeV2 = {
  version: 2;
  target: ComposerTarget;
  input: {
    text: string;
    mode: ComposerMode;
    model: string | null;
    runtimeMode: CodexRuntimeMode;
    contextItems: ComposerContextItem[];
    attachments: ComposerAttachment[];
    payload: ComposerPayload;
  };
  pendingRequestAnswerDrafts: Record<string, Record<string, string>>;
  updatedAt: string;
};
```

Rules:

- Successful send clears only `input`.
- Queue success clears only `input`.
- Approval resolution/cancel clears only the matching answer draft.
- Prefer `approvalId` when available; keep `requestId` as secondary identity.
- Do not promise restart recovery for answer drafts until approval recovery policy changes.

### P1 - Add Queue Hydration API And Restart Recovery

Problem: queue persistence exists, but renderer queue state is still local and there is no list/hydrate API in the plan.

Required additions:

- `listQueueItemsForConversation(conversationId)` in repository.
- Controller, IPC, preload, renderer transport methods.
- Queue projection from persisted rows plus local optimistic rows.
- Restart recovery for `queue_items.status = 'running'`.

Required return shape:

```ts
type PersistedQueueItem = {
  id: string;
  conversationId: string;
  admittedRequestId: string;
  position: number;
  status: "queued" | "running" | "completed" | "failed" | "canceled";
  request: ValidatedAdmittedComposerRequest;
  error?: string;
  createdAt: string;
  updatedAt: string;
};
```

Recommended recovery: mark running queue rows failed with `Queue execution interrupted by app restart`; leave queued rows queued.

Tests: queued row survives restart and appears; running row recovers by policy; hydrate dedupes optimistic row; UI execution order matches DB positions.

### P1 - Strip Non-Durable Attachment Fields

Problem: `ComposerAttachment.previewUrl` can be a blob URL. It is not restart-safe.

Required parser behavior:

- Strip `previewUrl` on persist or restore.
- Ready attachments require path/name/kind and supported MIME inference.
- Failed attachments may be preserved as diagnostics but cannot be admitted.
- Revalidate path existence and safety on send, not only restore.
- Enforce attachment count/size limits when rebuilding.

Tests: restored image has no stale blob URL; failed pathless attachment cannot send; unsupported MIME warns or rejects.

### P1 - Remove Or Define `capture` Target

Problem: `ComposerTarget` includes `capture`, but storage/API sections only define `draft` and `conversation`.

Required decision:

- If capture is in scope, define id rules, storage rows, clear behavior, and tests.
- If not, remove `capture` from this plan.

Recommendation: defer `capture` for this durability slice.

### P2 - Define Model And Runtime Restore Semantics

Problem: hook inputs include current model/runtime, while envelope also stores model/runtime.

Required rules:

- Draft route restore uses persisted model/runtime if present.
- Conversation follow-up defaults to conversation model/runtime, then applies persisted draft override if user changed it.
- Global model/runtime changes do not rewrite restored drafts until user edits or changes controls.
- Mode policy still de-escalates at admission.

### P2 - Define Conflict Policy

If only one desktop window is supported, state it. If multiple windows or reentrant writes are possible, add optimistic conflict handling.

Minimum policy:

- Last writer wins inside one app window.
- A stale empty write must not overwrite newer non-empty persisted content.
- If DB `updated_at` is newer than local hydrated revision, return a recoverable conflict warning.

### P2 - Strengthen Observability

Keep current "no prompt text" rule and add:

- Do not log attachment paths or file contents outside explicit debug mode.
- Log warning codes, not full malformed payloads.
- Include `targetKey`, `status`, `requestId`, `conversationId`, and warning code.

Suggested warning codes:

```txt
draft_parse_unknown_version
draft_parse_invalid_attachment
draft_hydrate_stale_result_ignored
draft_flush_failed
draft_clear_suppressed_autosave
draft_promotion_idempotent_replay
queue_hydrate_duplicate_optimistic_item
```

### P2 - Make Retention FK-Safe

Problem: deleting promoted drafts can sever `admitted_requests.draft_id` via `ON DELETE SET NULL`.

Required policy:

- Prefer compaction over deletion for promoted drafts.
- Delete discarded pre-conversation drafts only when unreferenced.
- For promoted rows after retention, keep `id`, `status`, `promoted_conversation_id`, timestamps, and minimal redacted envelope.
- Conversation follow-up audit should live in admitted request snapshots, not active draft rows.

### P2 - Define Route Recovery UI States

Opening `/draft/$draftId` should have explicit states:

- Missing row: empty composer, same id.
- Active row: hydrate composer.
- Promoting row: recovery state, then active or promoted based on pointer.
- Promoted row: redirect or open-conversation recovery surface.
- Discarded row: restore/new choice.
- Parse error: reset/diagnostic action; never overwrite automatically.

### P2 - Main Boundary Revalidates Restored Drafts

Restore parsing normalizes shape. Send remains the trust boundary.

Required:

- Main admitted request validation stays authoritative.
- Restored attachment paths are revalidated on admitted send.
- Folder/context snapshots from old drafts are bounded and treated as user-provided context.

## Suggested Phase Plan

- Phase 0 - Preflight contracts: limit targets to `draft` and `conversation`, define id validation/reserved prefixes, move shared types to `src/shared`, document envelope-vs-column truth. Gate: typecheck and parser tests.
- Phase 1 - Shared envelope parser: no renderer imports, strip non-durable fields, support v1 lazy migration, stable warnings, separate `input` from `pendingRequestAnswerDrafts`, validate target. Gate: parser edge-case tests.
- Phase 2 - DB/repository: add migration/backfill, target upsert/load/clear/restore APIs, atomic promotion, hard-delete conversation draft clear, interrupted promotion recovery, queue list/recovery. Gate: repository tests for exact ids, backfill, idempotency, reuse, queue recovery.
- Phase 3 - IPC/preload cutover: add new composer draft and queue hydration endpoints; make old random draft APIs legacy or remove. Gate: route composer does not call old random `createDraft`.
- Phase 4 - Renderer hook: hydrate by target with generation guard, flush old target before switch, suppress autosave after clear, separate input/answer clearing, restore model/runtime by policy. Gate: stale hydrate, clear suppression, failed flush, model restore, target switch tests.
- Phase 5 - Promotion route behavior: flush, admit, controller/main generates promotion ids, repository promotes atomically, return `{ draftId, conversationId, idempotentReplay }`, route only if current draft still matches, handle promoted/promoting/discarded/parse-error states. Gate: route tests and retry test.
- Phase 6 - Queue and pending request durability: hydrate queue with `PersistedQueueItem`, recover running queue rows, persist live approval answer drafts on conversation targets across route switches/remounts, clear only matching resolved answers. Gate: queue restart smoke and pending answer route-switch/remount smoke.
- Phase 6b - Approval restart recovery decision: only if approvals become restart-recoverable, extend pending answer drafts across app restart. Gate: approval restart smoke plus pending answer reload smoke.
- Phase 7 - Cleanup/retention: FK-safe compaction, no active draft deletion, no referenced promoted draft deletion unless intentional. Gate: cleanup tests.

## Regression Matrix

- Parser: v1 migration, unknown version, unknown mode/runtime, invalid target/reserved prefix, invalid payload/arrays, preview URL stripping, failed/pathless attachments, pending answer preservation.
- Repository: migration backfill, exact route ids, hard-delete conversation draft clear/recreate, promoted/discarded gating, draft-id-based idempotency, different-request rejection, interrupted promotion recovery, queue running recovery.
- IPC/preload: new endpoints validate targets, parse errors are recoverable, route composer avoids legacy random create, queue hydration returns persisted rows.
- Renderer hook: no write before hydrate, stale hydrate ignored, target switch flushes old target, send/queue flushes, clear does not recreate empty row, failed send preserves input, queue success clears input only, live pending answers survive normal clear.
- Route/E2E: existing draft restore, promoted/discarded recovery, missing conversation isolation, conversation switching restores follow-ups, immediate navigation/restart preserves prompt, promotion retry returns same conversation, queue items survive restart, live pending user-input answers survive route switch/remount.

## Implementation Contract

Target scope:

- Supported targets are `draft` and `conversation`.
- `capture` is deferred unless this plan is expanded with capture storage.
- Route draft ids are UUID strings only.
- Route draft ids may not use reserved internal prefixes such as `composer:`, `conversation:`, or `capture:`.

Storage contract:

- `payload_json` stores the versioned envelope.
- Top-level `drafts` columns are lifecycle/query mirrors derived from the envelope.
- On read, lifecycle columns win for status and promotion.
- On read, parsed envelope wins for composer content.
- Old rows are migrated lazily from columns plus v1 `payload_json`.
- Migration must backfill old promoted rows:

```sql
UPDATE drafts
SET status = 'promoted'
WHERE promoted_conversation_id IS NOT NULL;
```

Promotion contract:

- Promotion status transitions are owned by main-process controller/repository methods.
- Renderer may request promotion, but it must not independently mark a draft promoting without the matching promotion attempt.
- Renderer never generates conversation, provider session, turn, or message ids.
- Controller/main generates `PromotionIds` once inside the promotion command.
- Repository owns the DB transaction.
- Idempotency primarily uses `draftId + status + promoted_conversation_id`; admitted request id validates replay content.
- Renderer receives explicit promotion result:

  ```ts
  promoteComposerDraft(input: {
    draftId: string;
    request: ValidatedAdmittedComposerRequest;
    cwd?: string;
  }): Promise<{
    draftId: string;
    conversationId: string;
    idempotentReplay: boolean;
  }>;
  ```

Queue contract:

- Add queue hydration API:

  ```ts
  listConversationQueueItems(conversationId: string): Promise<PersistedQueueItem[]>;
  ```

- Return shape:

  ```ts
  type PersistedQueueItem = {
    id: string;
    conversationId: string;
    admittedRequestId: string;
    position: number;
    status: "queued" | "running" | "completed" | "failed" | "canceled";
    request: ValidatedAdmittedComposerRequest;
    error?: string;
    createdAt: string;
    updatedAt: string;
  };
  ```

- `queue_items.status = 'running'` from a previous process must be recovered by policy.
- Recommended recovery: mark running queue rows failed with `Queue execution interrupted by app restart`; leave queued rows queued.

Envelope contract:

- Shape separates normal `input` from `pendingRequestAnswerDrafts`.
- Normal send/queue clear only `input`.
- Conversation follow-up draft clear hard-deletes the row; admitted request snapshots are the audit trail.
- Approval resolution clears only the matching answer draft.
- Pending approval answer drafts live only on conversation composer targets.

Required test additions:

- ID namespace validation.
- Migration backfill.
- Atomic/idempotent promotion.
- Main-owned promotion id generation.
- Stale hydrate race.
- Clear suppresses autosave.
- Queue hydrate/restart recovery.
- `PersistedQueueItem` shape.
- Pending answer clear isolation across route switches/remounts.
- Attachment preview URL stripping.

## Non-Negotiables

- No route draft persists under a random DB id.
- No existing promoted draft is treated as active after migration.
- Promotion retry cannot create duplicate conversations.
- Stale hydrate or empty autosave cannot erase user input.
- Conversation follow-up drafts hard-delete on successful send/queue and can be recreated indefinitely.
- Queue items survive restart through explicit persisted APIs.
- Pending approval answer drafts survive route switches/remounts while approvals are live; restart recovery requires a separate approval-recovery decision.
- Shared parsing is truly shared and does not import renderer component modules.
- Cleanup never destroys the only recovery pointer or admitted-request audit trail.
