# Experimental Desktop Agent Draft Durability

Production implementation plan for robust composer/session persistence

Read when: touching `apps/experimental-desktop` composer, draft routes, conversation promotion, queueing, approval prompts, or local conversation persistence.

## Goal

Make the experimental desktop agent composer production-safe:

- No lost draft text on route changes, app refresh, app restart, failed sends, or delayed autosave.
- `/draft/$draftId` is a real durable draft identity, not just a URL shell.
- `/conversation/$conversationId` has its own follow-up composer draft.
- Draft promotion to a real conversation is explicit, recoverable, and idempotent.
- Queue, admitted request, and pending approval UX do not depend on fragile mounted React state.

This plan intentionally builds on the current app instead of importing another repo's architecture wholesale.

## Reference Repos Reviewed

Only the remaining actual agent repos under `/Users/rakesh/Developer/llm-agent` were considered.

### `t3code`

Best reference for long-lived composer state.

Relevant files:

- `t3code/apps/web/src/composerDraftStore.ts`
- `t3code/apps/web/src/components/chat/ChatComposer.tsx`

Useful decisions:

- Separate draft identity from real server thread identity.
- Persist draft state with a versioned schema.
- Keep model/runtime/provider selections inside the draft snapshot.
- Debounce writes, but flush before unload.
- Promotion is a lifecycle: mark draft as promoting, then finalize only after the canonical thread route is active.
- Tests cover migration, clearing, promotion, scoped environment identity, attachments, terminal context, and review/preview context.

What to copy conceptually:

- `DraftId`/`ThreadRef` split.
- Versioned draft envelope.
- Promotion marker before cleanup.
- Persistence tests as first-class implementation work.

What not to copy directly:

- Browser `localStorage` as primary storage. Our desktop app already has SQLite in the main process; that is better.

### `traycer`

Best reference for Electron durability boundaries.

Relevant files:

- `traycer/clients/desktop/src/ipc-contracts/window-types.ts`
- `traycer/clients/desktop/src/ipc-contracts/window-state-parsers.ts`
- `traycer/clients/desktop/src/electron-main/windows/per-window-state.ts`
- `traycer/clients/desktop/src/electron-main/windows/desktop-state-store.ts`

Useful decisions:

- Plain-data IPC contract.
- Shared parser used by IPC and disk restore.
- Atomic persistence and explicit flush.
- Stable active draft id is persisted separately from draft content.
- Restore reconciles stale/duplicate window state instead of trusting old state blindly.

What to copy conceptually:

- Parse once at the boundary; consumers use typed values.
- Restore path must be explicit and tested.
- Persist active identity, not just content.

What not to copy directly:

- JSON file storage. Our app already uses `better-sqlite3` with WAL mode for conversations.

### `AionUi`

Best reference for controlled sendbox UX.

Relevant files:

- `AionUi/packages/desktop/src/renderer/hooks/chat/useSendBoxDraft.ts`
- `AionUi/packages/desktop/src/renderer/pages/conversation/platforms/acp/AcpSendBox.tsx`
- `AionUi/packages/desktop/src/renderer/components/chat/SendBox/index.tsx`

Useful decisions:

- Composer is controlled by parent state.
- Draft is keyed by conversation id.
- Draft contains text and selected files.
- Send clears input only after the parent send path accepts the request.
- Failed send keeps the user's draft.

What to copy conceptually:

- Controlled composer, no hidden textarea-only draft state.
- Conversation-keyed follow-up drafts.
- Clear-on-success, preserve-on-failure.

What not to copy directly:

- Module-level in-memory Map as final storage. It survives route switches, not app restarts.

### `pawwork`

Best reference for explicit routing identity and concurrency discipline.

Relevant files:

- `pawwork/packages/remote-bridge/README.md`
- `pawwork/packages/remote-bridge/src/engine.ts`

Useful decisions:

- Remote conversations are keyed by a stable explicit key.
- No implicit broadcast; one session has one active output target.
- Concurrent first-session creation is coalesced per key.
- Pending blockers are ordered and surfaced one at a time.

What to copy conceptually:

- Stable key derivation. No hand-built accidental ids.
- Coalesce first draft/session creation to avoid orphaned sessions.
- Pending approval/user-input drafts should be scoped to the visible blocker.

### `opncode`

`opncode` currently has no inspectable files in this local folder, so it did not contribute implementation guidance.

## Current App State

The current app already has several strong foundations.

### Existing good foundations

- SQLite conversation DB in `apps/experimental-desktop/src/main/storage/database.ts`.
- `drafts` table with:
  - `id`
  - `text`
  - `cwd`
  - `model`
  - `runtime_mode`
  - `attachments_json`
  - `payload_json`
  - `promoted_conversation_id`
- WAL mode, foreign keys, busy timeout.
- `admitted_requests` table with draft snapshots and request snapshots.
- `queue_items` table for persisted queue execution.
- `ConversationRepository.promoteDraft()` marks `drafts.promoted_conversation_id` instead of deleting the draft.
- `ComposerRegion` clears composer only when send/queue succeeds.
- Existing tests already cover send success/failure, queueing, and draft sync debounce basics.

### Current fragility

These are the production gaps this plan fixes.

1. **Route draft id is not the durable DB draft id.**
   - `DraftRoute` passes `routeDraftId` into `DesktopCompatibilityView`.
   - `ComposerRegion` uses it as `draftScopeId`, but `useConversationSessionController.persistDraft()` creates a random DB draft when `session.draftId` is absent.
   - Result: `/draft/$draftId` can be a stable URL while the DB row has a different id.

2. **Draft routes do not hydrate persisted content.**
   - `DraftRoute` renders the composer, but there is no `loadDraft(routeDraftId)` path.
   - `ComposerRegion` resets when a route draft opens and calls `createNewSession()`.
   - Result: opening an existing draft URL starts empty even if SQLite has content.

3. **Conversation follow-up drafts are explicitly disabled.**
   - `shouldPersistComposerDraft()` returns false when `conversationId` exists.
   - Result: switching away from a conversation can lose an unsent follow-up prompt.

4. **Autosave has no flush contract.**
   - `useComposerDraftSync()` debounces for 350ms.
   - It does not flush on blur, route transition, app unload, send, or unmount.
   - Result: fast navigation or send-before-debounce can race persistence.

5. **Hydrate-before-persist guard is missing.**
   - An empty composer can autosave before a draft finishes loading.
   - Result: restore can be overwritten by an empty draft.

6. **Draft payload is untyped at the IPC/main boundary.**
   - `validateDraftBody()` accepts `payload?: unknown`, `attachments?: unknown[]`.
   - `mapDraft()` parses JSON but does not normalize the payload shape.
   - Result: corrupted/old payloads can leak to renderer logic or silently degrade.

7. **Pending approval/user-input drafts are local component state.**
   - `SessionComposer` stores `userInputDrafts` in component state.
   - Result: approval answers can disappear if the composer remounts.

## Recommended Architecture

Use the best parts of the references, but map them to our app:

- **T3 Code:** draft/conversation identity split + versioned envelope + promotion lifecycle.
- **Traycer:** main-process persistence boundary + shared parsers + explicit restore.
- **AionUi:** controlled composer keyed by active target.
- **PawWork:** stable key derivation + coalesced first creation + ordered blockers.

### Core principle

The composer should be keyed by a stable `ComposerTarget`, not by component lifetime.

```ts
export type ComposerTarget =
  | { kind: "draft"; id: string; workspaceRoot?: string }
  | { kind: "conversation"; id: string; workspaceRoot?: string }
  | { kind: "capture"; id: string; workspaceRoot?: string };

export function composerTargetKey(target: ComposerTarget) {
  return `${target.kind}:${target.id}`;
}
```

Rules:

- `/draft/$draftId` uses `ComposerTarget { kind: "draft", id: draftId }`.
- `/conversation/$conversationId` uses `ComposerTarget { kind: "conversation", id: conversationId }`.
- Never create a random DB draft for a route draft.
- Never persist by `workspaceRoot` alone; workspace is metadata/scope, not identity.
- Never let a component remount define whether a draft exists.

## Storage Model

### Recommended migration

Keep the existing `drafts` table. It is already connected to promotion and `admitted_requests`.

Add fields needed to turn it into a durable composer-state table for both pre-conversation and conversation follow-up drafts.

```sql
ALTER TABLE drafts ADD COLUMN version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE drafts ADD COLUMN mode TEXT NOT NULL DEFAULT 'ask';
ALTER TABLE drafts ADD COLUMN conversation_id TEXT REFERENCES conversations(id) ON DELETE CASCADE;
ALTER TABLE drafts ADD COLUMN scope_key TEXT;
ALTER TABLE drafts ADD COLUMN status TEXT NOT NULL DEFAULT 'active'
  CHECK (status IN ('active', 'promoting', 'promoted', 'discarded'));
ALTER TABLE drafts ADD COLUMN last_restored_at TEXT;
ALTER TABLE drafts ADD COLUMN last_error TEXT;

CREATE UNIQUE INDEX drafts_active_conversation_id_unique
  ON drafts(conversation_id)
  WHERE conversation_id IS NOT NULL AND status = 'active';

CREATE INDEX drafts_status_updated_at_idx ON drafts(status, updated_at);
CREATE INDEX drafts_conversation_id_idx ON drafts(conversation_id);
```

Why extend `drafts` instead of adding another table:

- `admitted_requests.draft_id` already references `drafts(id)`.
- `promoteDraft()` already marks `promoted_conversation_id`.
- Fewer concepts: one durable composer state table.
- Existing draft rows migrate naturally.

### Draft id rules

Pre-conversation draft route:

```text
id = route draft id
conversation_id = null
status = active | promoting | promoted | discarded
promoted_conversation_id = set after promotion
```

Conversation follow-up draft:

```text
id = composer:conversation:<conversationId>
conversation_id = conversationId
status = active | discarded
promoted_conversation_id = null
```

Rationale:

- Pre-conversation drafts are promotable.
- Conversation follow-up drafts are not promoted; they become ordinary turns.
- `conversation_id` unique index ensures one live composer draft per conversation.

## Versioned Draft Envelope

Create one shared parser/encoder used by renderer, preload, and main process.

Suggested file:

```text
apps/experimental-desktop/src/shared/composer-draft-envelope.ts
```

Shape:

```ts
export const COMPOSER_DRAFT_ENVELOPE_VERSION = 2;

export type ComposerDraftEnvelopeV2 = {
  version: 2;
  target: ComposerTarget;
  text: string;
  mode: ComposerMode;
  model: string | null;
  runtimeMode: CodexRuntimeMode;
  contextItems: ComposerContextItem[];
  attachments: ComposerAttachment[];
  payload: ComposerPayload;
  pendingRequestAnswerDrafts: Record<string, Record<string, string>>;
  updatedAt: string;
};
```

Parser requirements:

- Unknown version returns a recoverable parse error, not a crash.
- Malformed arrays normalize to empty arrays.
- Unknown composer mode normalizes to `ask` and records a warning.
- Unknown runtime mode normalizes to `read-only` and records a warning.
- Payload is rebuilt from canonical fields when invalid.
- Attachments are filtered to valid local attachment shapes.
- Parser result should be `{ ok: true, draft, warnings } | { ok: false, error }`.

This mirrors Traycer's shared parser boundary and T3 Code's migration discipline.

## Main Process API

Add explicit draft APIs. Avoid overloading `createDraft`/`updateDraft` with route semantics.

Recommended IPC/preload surface:

```ts
loadComposerDraft(target: ComposerTarget): Promise<ComposerDraftEnvelopeV2 | null>;
upsertComposerDraft(target: ComposerTarget, draft: ComposerDraftEnvelopeV2): Promise<ComposerDraftEnvelopeV2>;
clearComposerDraft(target: ComposerTarget): Promise<void>;
markDraftPromoting(draftId: string): Promise<void>;
finalizeDraftPromotion(draftId: string, conversationId: string): Promise<void>;
restorePromotedDraft(draftId: string): Promise<{ conversationId: string } | null>;
```

Implementation mapping:

- `loadComposerDraft({ kind: "draft", id })` reads `drafts.id = id`.
- `loadComposerDraft({ kind: "conversation", id })` reads `drafts.conversation_id = id AND status = 'active'`.
- `upsertComposerDraft({ kind: "draft", id })` calls `repo.updateDraft({ id, ... })`, not `createDraft(randomUUID())`.
- `upsertComposerDraft({ kind: "conversation", id })` upserts `id = composer:conversation:${id}`, `conversation_id = id`.
- `markDraftPromoting()` changes `status = 'promoting'` before sending.
- `finalizeDraftPromotion()` changes `status = 'promoted'`, sets `promoted_conversation_id`.
- `clearComposerDraft()` marks `discarded` or clears text/context/attachments. Prefer tombstone for pre-conversation drafts, hard clear for conversation follow-ups.

## Renderer State Model

Replace `useComposerDraftStore()` with a target-aware store/hook.

Suggested files:

```text
apps/experimental-desktop/src/renderer/components/composer/core/usePersistentComposerDraft.ts
apps/experimental-desktop/src/renderer/components/composer/core/composerDraftPersistence.ts
```

Hook contract:

```ts
const composer = usePersistentComposerDraft({
  target,
  model,
  runtimeMode,
  workspaceRoot,
});
```

It should expose:

```ts
{
  status: "loading" | "ready" | "error";
  draft;
  text;
  setText;
  mode;
  setMode;
  contextItems;
  setContextItems;
  attachments;
  setAttachments;
  pendingRequestAnswerDrafts;
  setPendingRequestAnswerDrafts;
  resetLocal;
  clearPersisted;
  flush;
}
```

Critical behavior:

1. Hydrate before autosave.
2. Do not write an empty default draft until hydration completes.
3. Debounce normal typing writes.
4. Flush on:
   - blur
   - route target change
   - component unmount
   - app `beforeunload`
   - send start
   - queue start
5. If send fails, keep the local and persisted draft.
6. If send succeeds, clear only the exact target.
7. If queue succeeds, clear only the exact target.
8. If queue admission fails, keep the draft.
9. If the route target changes, do not reset global composer state; switch to the new target and hydrate that target.

## Route Behavior

### `/draft/$draftId`

Desired behavior:

1. Route computes `target = { kind: "draft", id: draftId }`.
2. Composer hydrates from SQLite row `drafts.id = draftId`.
3. If row does not exist, composer starts empty but first autosave creates row with `id = draftId`.
4. Send path passes `draftId` to promotion.
5. If promotion returns `conversationId`, navigate to `/conversation/$conversationId` only if:
   - the promoted draft id matches the current route draft id, and
   - the DB row has `promoted_conversation_id = conversationId` or the send response includes that mapping.
6. If send fails, stay on `/draft/$draftId`, status returns to `active`, composer content remains.

### `/conversation/$conversationId`

Desired behavior:

1. Conversation route loads conversation detail as today.
2. Composer target is `{ kind: "conversation", id: conversationId }`.
3. Follow-up composer text/context/attachments persist to a conversation-scoped draft row.
4. Sending an ordinary follow-up clears the conversation draft only after the turn/admitted request is durably accepted.
5. Queueing a follow-up clears the conversation draft only after `queue_items` row exists.
6. Switching between conversations restores each conversation's draft.

## Promotion Lifecycle

Borrow T3 Code's lifecycle but store it in SQLite.

### State machine

```text
active -> promoting -> promoted
active -> discarded
promoting -> active     # send failed before durable conversation acceptance
promoting -> promoted   # send accepted and conversation id exists
```

### Send flow for `/draft/$draftId`

1. `flush(target)`.
2. Admit composer payload.
3. `markDraftPromoting(draftId)`.
4. Call `promoteDraftAndSendAdmitted({ draftId, request, cwd })`.
5. Main process transaction:
   - creates conversation
   - creates provider session
   - creates turn
   - creates user/assistant messages
   - records admitted request with draft snapshot
   - sets `drafts.status = 'promoted'`
   - sets `drafts.promoted_conversation_id = conversationId`
6. Renderer hydrates returned conversation.
7. Navigate to `/conversation/$conversationId`.

If any step after mark-promoting fails:

- Set `drafts.status = 'active'`.
- Keep draft content.
- Keep route.
- Show error.

### Recovery on app restart

At startup:

- `status = 'promoting' AND promoted_conversation_id IS NULL` -> set back to `active` with `last_error = 'Promotion interrupted by app restart'`.
- `status = 'promoting' AND promoted_conversation_id IS NOT NULL` -> set to `promoted`.
- `status = 'promoted'` remains loadable only as a redirect/recovery pointer.

Opening `/draft/$draftId` when promoted:

- If `promoted_conversation_id` exists, route should offer/open the conversation instead of showing an empty draft.

## Queue and Pending Request Drafts

### Queue

Current queue persistence is already good:

- `admitted_requests`
- `queue_items`
- queue execution paths

Required improvement:

- Hydrate queue state from DB when opening a conversation, not only from current renderer memory.
- Queue state in `ComposerQueueStore` should be a projection of persisted queue rows plus local optimistic UI.

### Pending approvals / user-input prompts

Current problem:

- `SessionComposer` keeps `userInputDrafts` in local state.

Recommended fix:

- Move `pendingRequestAnswerDrafts` into `ComposerDraftEnvelopeV2` under the conversation target.
- Key by `requestId -> questionId -> value`.
- Clear answers only when request resolves or is canceled.
- Preserve answers across route switches/reloads.

This follows PawWork's blocker discipline: user answers belong to the visible pending blocker, not to a generic input component.

## Write-Gate / Validation Contract

One parser owns draft validity.

Do:

- Shared draft envelope parser in `src/shared`.
- Main IPC validates every write.
- Renderer validates every restore result.
- Parser performs migration/normalization.
- Invalid persisted draft records surface a recoverable error state with a reset button.

Do not:

- Let `payload: unknown` reach composer logic.
- Let renderer and main define separate draft shapes.
- Silently discard invalid draft content without a diagnostic.
- Clear a draft because parsing failed.

## Observability

Add structured logs around:

- draft restore started/completed/failed
- draft upsert failed
- draft parse warning/error
- promotion started/completed/failed
- promotion recovery on startup
- conversation follow-up draft clear
- queue hydrate mismatch

Minimum log fields:

```ts
{
  targetKind,
  targetId,
  draftId,
  conversationId,
  status,
  errorMessage,
}
```

Avoid logging full prompt text or local file contents.

## Implementation Phases

### Phase 1 — Contracts and parsers

Files:

- `apps/experimental-desktop/src/shared/composer-draft-envelope.ts`
- `apps/experimental-desktop/src/shared/__tests__/composer-draft-envelope.test.ts`

Work:

- Define `ComposerTarget`.
- Define `ComposerDraftEnvelopeV2`.
- Add encode/decode/migrate helpers.
- Add parse warnings.
- Add tests for malformed payload, unknown mode, unknown runtime mode, old v1 payload, and attachment cleanup.

### Phase 2 — Main-process persistence API

Files:

- `apps/experimental-desktop/src/main/storage/database.ts`
- `apps/experimental-desktop/src/main/conversations/repository.ts`
- `apps/experimental-desktop/src/main/conversations/controller.ts`
- `apps/experimental-desktop/src/main/ipc.ts`
- `apps/experimental-desktop/src/preload/types.ts`
- `apps/experimental-desktop/src/preload/index.ts`

Work:

- Add draft migration fields.
- Add repository methods:
  - `getDraftByTarget`
  - `upsertDraftForTarget`
  - `clearDraftForTarget`
  - `markDraftPromoting`
  - `recoverInterruptedDraftPromotions`
- Add IPC/preload methods.
- Call promotion recovery at controller startup.

### Phase 3 — Renderer persistent composer hook

Files:

- `apps/experimental-desktop/src/renderer/components/composer/core/usePersistentComposerDraft.ts`
- `apps/experimental-desktop/src/renderer/components/composer/ComposerRegion.tsx`
- `apps/experimental-desktop/src/renderer/app/DesktopCompatibilityView.tsx`
- `apps/experimental-desktop/src/renderer/routes/draft.$draftId.tsx`
- `apps/experimental-desktop/src/renderer/routes/conversation.$conversationId.tsx`

Work:

- Compute `ComposerTarget` from route/session.
- Hydrate composer by target.
- Persist after hydrate only.
- Flush on send/queue/navigation/unmount.
- Stop using route draft id as only `draftScopeId`; use it as real DB draft id.
- Persist conversation follow-up drafts.

### Phase 4 — Promotion recovery and route behavior

Files:

- `apps/experimental-desktop/src/renderer/app/desktopRoutePromotion.ts`
- `apps/experimental-desktop/src/renderer/app/DesktopCompatibilityView.tsx`
- `apps/experimental-desktop/src/main/conversations/controller.ts`

Work:

- Mark promoting before send.
- Finalize only after conversation is durable.
- Route only when current route draft id matches promoted draft id.
- Opening a promoted draft redirects/offers conversation recovery.
- Failed send restores `active` draft status.

### Phase 5 — Queue and pending request draft hydration

Files:

- `apps/experimental-desktop/src/renderer/components/composer/SessionComposer.tsx`
- `apps/experimental-desktop/src/renderer/components/composer/PendingRequestDock.tsx`
- `apps/experimental-desktop/src/renderer/components/composer/core/composerQueueStore.ts`
- `apps/experimental-desktop/src/main/conversations/repository.ts`

Work:

- Move `userInputDrafts` into target draft envelope.
- Hydrate queue items from DB on conversation open.
- Keep optimistic queue UI, reconcile with persisted rows.

### Phase 6 — Cleanup / retention

Policy:

- Active drafts: keep forever until user discards.
- Promoted drafts: keep 30 days as recovery/admitted-request audit trail, then compact content but keep `id -> promoted_conversation_id` pointer if referenced.
- Discarded pre-conversation drafts: delete after 7 days.
- Conversation follow-up drafts with empty content: delete immediately or mark discarded.

Add a main-process cleanup function gated by app startup or manual maintenance command. Do not run aggressive cleanup during active send.

## Regression Test Plan

### Parser tests

- Old draft payload migrates to v2.
- Unknown mode normalizes to `ask` with warning.
- Unknown runtime mode normalizes to `read-only` with warning.
- Invalid attachments are removed.
- Invalid payload does not crash restore.

### Main repository tests

- `upsertDraftForTarget(draft:id)` creates row using exact route id.
- `upsertDraftForTarget(conversation:id)` creates one active row per conversation.
- Updating a conversation draft does not create duplicates.
- `markDraftPromoting` is idempotent.
- Failed promotion returns status to active.
- Promoted draft stores `promoted_conversation_id`.
- Startup recovery repairs interrupted promoting rows.

### Renderer hook tests

- Does not persist empty draft before hydrate completes.
- Hydrates `/draft/draft-a` content.
- Switching draft routes flushes old draft and hydrates new draft.
- Switching conversations restores each follow-up draft.
- Fast unmount flushes pending write.
- Failed send keeps text/context/attachments.
- Successful send clears only the active target.
- Queue admission failure keeps draft.
- Queue success clears active conversation draft.

### Route tests

- Opening `/draft/:id` with existing DB row shows persisted text.
- Opening `/draft/:id` with promoted row navigates/offers conversation recovery.
- Sending draft route navigates only when matching draft id is promoted.
- Opening missing conversation does not clear unrelated draft.

### End-to-end smoke

1. Open new draft route.
2. Type prompt + attach context.
3. Navigate to another route immediately.
4. Return to draft route; prompt restored.
5. Restart app; prompt restored.
6. Send; route becomes conversation route.
7. Type follow-up; switch conversation; return; follow-up restored.
8. Simulate failed send; prompt still present.

## Non-Goals

- No cloud sync for drafts yet.
- No multi-device draft merge.
- No collaborative composer editing.
- No wholesale rewrite of conversation storage.
- No localStorage fallback for production persistence.

## Final Decision

Use SQLite-backed, target-keyed, versioned composer drafts.

Concretely:

- `drafts.id` must equal `/draft/$draftId` for draft routes.
- Conversation follow-up drafts must persist with `conversation_id`.
- Renderer composer state must hydrate by `ComposerTarget` before autosave.
- All draft writes must pass one shared envelope parser.
- Send/queue must flush before request admission.
- Drafts clear only after durable acceptance.
- Promotion is a DB status transition, not a React-side assumption.

This is the best fit for our app because it keeps the current SQLite/admitted-request/queue foundation, borrows T3 Code's lifecycle rigor, Traycer's boundary discipline, AionUi's controlled composer UX, and PawWork's explicit identity model.
