# Composer + Conversation Execution Checklist

Implementation checklist for `COMPOSER_CONVERSATION_MASTER_PLAN.md`.

```txt
Created: 2026-06-23
Use with: COMPOSER_CONVERSATION_MASTER_PLAN.md, COMPOSER_PARITY_IMPLEMENTATION_PLAN.md
```

## Ground Rules

- Before starting any doc-plan slice, reread the relevant local reference repos/files even if they were reviewed before.
- Use the reference maps to find the right source files first, then inspect the current reference implementation behavior before coding.
- When a slice borrows from a specific app or pattern, such as T3Code routes, OpenCode request parts, or AionUI shell/resource ownership, revisit that repo's relevant files before deciding our implementation.
- Do not assume best practice from this repo alone. Understand what the reference app chose, compare it with our product constraints, then implement the smallest fitting version here.
- Record any new reference-driven decision in this checklist or the companion plan before or alongside the code change.
- Optimize for the clean architecture, not easiest migration.
- Current data can break.
- Codex ships first.
- Queue ships with the first real architecture pass.
- Shell is tracked but blocked until capability policy is ready.
- DB changes are allowed now.
- Keep files focused and under the repo LOC guidance.

## Phase 0 — Router And App Shell

Goal: `App.tsx` stops being the owner of app behavior.

Add:

```txt
src/renderer/app/router.tsx
src/renderer/app/routeTree.tsx
src/renderer/app/DesktopLayout.tsx
src/renderer/app/providers.tsx
src/renderer/routes/root.tsx
src/renderer/routes/draft.$draftId.tsx
src/renderer/routes/conversation.$conversationId.tsx
src/renderer/routes/capture.tsx
```

Tasks:

- Add TanStack Router dependency.
- Create route tree with `/`, `/draft/:draftId`, `/conversation/:conversationId`, `/capture`.
- Move shell grid/sidebar/right inspector into `DesktopLayout`.
- Keep current UI mounted through compatibility route while stores are extracted.
- Make sidebar actions navigate, not mutate global app state.
- Add route not-found handling for missing conversations/drafts.

Tests/gates:

- Typecheck.
- Route param parsing tests if practical.
- Manual smoke: new route, conversation route, capture route render without send behavior changing.

Done:

- `App.tsx` is only providers + router.
- Route owns active identity.
- No composer draft state in `App.tsx`.

Compatibility strategy:

- First router slice uses code-based TanStack Router routes so Electron/Vite does not need route generation yet.
- `App.tsx` becomes `AppProviders` + `RouterProvider`.
- Current desktop behavior is parked in `DesktopCompatibilityView` while route/resource extraction continues.
- Sidebar new/open actions navigate to `/draft/:draftId` and `/conversation/:conversationId`; compatibility route effects perform the current session reset/open calls.
- `/capture` mounts the compatibility shell for now so the route exists without inventing quick-capture state early.
- Replace `DesktopCompatibilityView` with route-owned draft/conversation resources in the later Phase 2/3 slices.
- First send from a draft route promotes the URL to `/conversation/:conversationId` when the compatibility session hydrates the promoted conversation.
- Long-term admitted endpoints should return the promoted conversation id directly instead of relying on compatibility session state.

Route resource progress:

- Reread AionUI conversation not-found redirect, T3Code draft/thread route guards, and OpenCode session loading patterns before adding route-state UI.
- Added `conversationTransport.ts` as the renderer transport wrapper for loading conversation detail and subscribing to conversation events.
- Added `conversationResourceStore.ts` so `/conversation/:conversationId` owns the initial `ConversationDetail` load state.
- `DesktopCompatibilityView` now hydrates compatibility session state from the route-loaded conversation resource instead of fetching directly from the route effect.
- Route-loaded conversation opens still reset the local composer state through the compatibility bridge, matching the previous sidebar-open behavior.
- Route effects depend on route identity/resource primitives instead of the whole compatibility session object.
- `/conversation/:conversationId` now renders route-owned loading, missing, and error states before mounting the compatibility view.
- `/capture` now has its own route-state surface instead of pretending to be the normal chat route; real quick-capture storage comes later.

## Phase 1 — Main DB And Domain Schema

Goal: create durable storage for the real product shape before renderer depends on it.

Add or migrate:

```txt
src/main/conversations/admitted-request.ts
src/main/conversations/provider-envelope.ts
src/main/conversations/message-parts.ts
src/main/conversations/queue.ts
src/main/conversations/quick-capture.ts
src/main/conversations/projector.ts
```

Schema work:

- Expand `message_parts.type` for text, file/image/context refs, tool calls/results, approvals, diffs, app actions, quick capture, compaction, errors, raw.
- Add `admitted_requests`.
- Add `queue_items`.
- Add `quick_captures`.
- Add provider envelope fields where needed.
- Store request parts and admission result as durable JSON.
- Store provider target separately from provider-native payload.

Validation:

- validate admitted request idempotency.
- validate draft/conversation route target.
- validate provider envelope against admitted parts.
- validate local files and images at main boundary.
- validate runtime mode against capability policy.
- validate queue item again at execution time.

Tests/gates:

- Repository tests for new tables.
- Validation tests for rejected injected file paths.
- Typecheck/build.

Done:

- DB can persist all row types needed by the planned timeline.
- Main can reject invalid admitted/provider envelopes before runtime.

## Phase 2 — Conversation Client Layer

Goal: replace `useCodexSession.ts` with smaller route/resource/projection pieces.

Reference-first decision:

- Reread OpenCode `packages/core/src/session/projector.ts`, `packages/app/src/pages/session/timeline/model.ts`, and `packages/app/src/pages/session/timeline/projection.ts`; keep projection as a pure layer feeding UI state, not as component-local stream mutation.
- Reread T3Code `MessagesTimeline.logic.ts` and `state/threads.ts`; derive stable timeline state outside the React view and keep route/thread state separate.
- Reread AionUI conversation route and ACP stream hook; keep route fetch/subscription boundaries separate from message rendering.
- For this app, start with a small pure `conversationProjection.ts` that projects current `ConversationDetail` and live `ConversationEvent` into the existing compatibility transcript/pending/status shape before extracting larger stores.
- Next event-store slice keeps subscription cleanup and duplicate-event suppression outside `useCodexSession`, following the reference pattern where stream lifecycle is scoped to the active route/session id.
- Projection treats `request.pending` as idempotent by provider request id / approval row identity so route-loaded pending approvals do not duplicate when the stream replays an equivalent pending event.
- Conversation history/sidebar state now follows the reference pattern of an independent list store: `conversationHistoryStore.ts` owns list refresh, subscriber snapshots, stale refresh suppression, and refresh errors outside the active session hook.
- `conversationClient.ts` now owns draft persistence, admitted send/promotion, approval response, interrupt, and detail load transport calls so `useCodexSession` remains a compatibility orchestrator instead of the IPC edge.
- `useConversationRoute.ts` now starts the ready-route controller boundary for route-owned conversation identity, projection state, live event subscription, event log, and history refresh. Send/respond/interrupt remain in the compatibility session until the composer route pass.
- `useConversationSessionController.ts` now owns the remaining compatibility session action/projection orchestration under the conversation layer; `useCodexSession.ts` is only a legacy wrapper for the current compatibility view.

Add:

```txt
src/renderer/conversations/conversationClient.ts
src/renderer/conversations/conversationHistoryStore.ts
src/renderer/conversations/conversationResourceStore.ts
src/renderer/conversations/conversationEventStore.ts
src/renderer/conversations/conversationProjection.ts
src/renderer/conversations/conversationTransport.ts
src/renderer/conversations/useConversationRoute.ts
```

Move out of `useCodexSession.ts`:

- list conversations.
- load conversation detail.
- subscribe/unsubscribe.
- event dedupe.
- pending request derivation.
- status derivation.
- transcript/timeline projection.
- interrupt/respond transport.

Rules:

- Event subscription is scoped to active route id.
- Projection is pure/testable where possible.
- Conversation history store is independent from active conversation detail.

Tests/gates:

- Projection tests for message created, delta, completed, failed, approval pending/resolved, compaction.
- Subscription cleanup test if practical.
- Typecheck/build.

Done:

- `useCodexSession.ts` is deleted or a thin compatibility shim.
- Renderer projection no longer lives in the transport hook.

## Phase 3 — Composer Domain Inside Routes

Goal: composer becomes route-scoped and provider-neutral.

Use `COMPOSER_PARITY_IMPLEMENTATION_PLAN.md` for detailed composer-domain implementation.

Reference-first decision:

- Reread OpenCode `session-composer-region.tsx`, `session-composer-state.ts`, `context/prompt.tsx`, and `build-request-parts.ts`; keep the region as the owner of scoped prompt/draft composition while the input component stays mostly presentational.
- Reread T3Code `ChatComposer.tsx` and `composerDraftStore.ts`; keep editable draft state keyed by route/draft identity and preserve draft on failed sends.
- Reread AionUI `AcpSendBox.tsx` and `ChatConversation.tsx`; keep provider/runtime policy outside the raw input component and avoid pushing route state into the send box.
- For this app, start with `ComposerRegion.tsx` as a compatibility boundary around `SessionComposer`: it owns live draft state, draft sync, admission, send clearing, and draft-route reset while preserving the current textarea UI.

Add:

```txt
src/renderer/components/composer/ComposerRegion.tsx
src/renderer/components/composer/core/composerDraftTypes.ts
src/renderer/components/composer/core/composerDraftStore.ts
src/renderer/components/composer/core/composerDraftSync.ts
src/renderer/components/composer/core/composerRequestParts.ts
src/renderer/components/composer/core/composerSendController.ts
src/renderer/components/composer/core/composerModePolicy.ts
src/renderer/components/composer/core/runtimeCapabilityMap.ts
src/renderer/components/composer/core/composerProviderTypes.ts
src/renderer/components/composer/adapters/codexComposerAdapter.ts
```

Tasks:

- Create `ComposerDraft` with text, mode, runtime selection, model target, context items, attachments, updatedAt.
- Build `ComposerRequestPart[]` from draft.
- Create `AdmittedComposerRequest`.
- Create Codex adapter branch.
- Move draft debounce/hydration/clear to `ComposerDraftSync`.
- Remove parent echo state from `App.tsx`.
- Keep current textarea initially.

Tests/gates:

- Request parts order/dedupe tests.
- Attachment regression tests.
- Admission tests.
- Draft sync clear-on-success and preserve-on-failure tests.
- Typecheck/build.

Done:

- `ComposerRegion` receives route/session context only.
- `SessionComposer` no longer orchestrates admission.
- `useCodexSession` does not build provider input.

Progress:

- Added `ComposerRegion.tsx` and moved live composer state, draft persistence sync, admission/send clearing, and draft-route reset out of `DesktopCompatibilityView`.
- `DesktopCompatibilityView` now owns shell/layout/route loading/model preference; it no longer owns message text, composer mode, context items, attachments, or composer draft persistence.
- Added `ComposerRegion` tests for route draft reset, draft persistence through `ComposerDraftSync`, clear-on-success, and preserve-on-failure.
- Added `composerRequestParts.ts` and moved provider-agnostic request-part building out of `composerSendController.ts`; tests now lock ordering and dedupe behavior.
- Added `composerDraftStore.ts` as the live editable draft state seam used by `ComposerRegion`.
- `ComposerRegion` now admits from `ComposerDraft`; `SessionComposer` submits without building a `ComposerPayload`.
- `admitComposerRequest` remains only as a compatibility wrapper around draft admission for existing tests/legacy callers.
- Review follow-up fixed stale draft-route promotion: draft routes now navigate to a conversation only after that same draft starts a send.
- Review follow-up fixed admission ordering so broken/pathless/MIME-less attachments are reported before empty-message validation.
- Review follow-up fixed draft-sync debounce starvation by keeping `persistDraft` in a ref instead of restarting the timer on function identity churn.

## Phase 4 — Admitted Send Endpoints

Goal: renderer sends explicit admitted requests.

Reference-first decision:

- Reread OpenCode `packages/core/src/session/input.ts` and `packages/core/src/session/prompt.ts`; keep admission as an explicit durable object before the provider prompt is promoted, and preserve provider-native prompt/file shapes inside the provider envelope.
- Reread AionUI `packages/desktop/src/renderer/pages/conversation/platforms/useConversationCommandQueue.ts`; queue admission should normalize and cap queued state, with full edit/pause/resume UI deferred to Phase 5.
- Reread T3Code mobile composer draft state; route-keyed drafts stay preserved on failed send, and admitted transport should not rebuild a legacy text-only payload in the session layer.
- For this app, Phase 4 keeps the legacy send IPC path for compatibility but moves the real `conversationClient.sendAdmittedRequest` path to full `AdmittedComposerRequest` transport. Main validates Codex provider envelopes against admitted `ComposerRequestPart[]` before runtime handoff.

Add IPC/main endpoints:

```txt
conversation:promote-draft-and-send-admitted
conversation:send-admitted-message
conversation:enqueue-admitted-message
conversation:queue-update
conversation:queue-execute-next
```

Tasks:

- Promote draft route send into persisted conversation.
- Continue conversation route send.
- Persist admitted request before runtime handoff.
- Create user/assistant placeholders from admitted request.
- Start Codex runtime from Codex provider envelope.
- Revalidate queued item before execution.
- Return conversation id after promotion for route navigation.

Tests/gates:

- Promote draft succeeds and persists admitted request.
- Promotion failure preserves draft.
- Follow-up send creates turn/messages.
- Invalid provider envelope rejected.
- Queue item admitted while busy.
- Typecheck/build.

Done:

- Added durable `admitted_requests` and `queue_items` tables in migration `0006_admitted_requests_queue`.
- Added main validation for admitted Codex requests, including rejecting provider native file/image paths not present in admitted request parts.
- Added IPC/preload endpoints for admitted draft promotion, admitted follow-up send, admitted enqueue, queue update, and queue execute-next.
- `conversationClient.sendAdmittedRequest` now transports the full admitted request instead of converting back to legacy `{ text, nativeInput, payload }`.
- Draft promotion and follow-up sends persist the admitted request before starting the Codex runtime, while still storing legacy composer payload metadata in the user text part for current timeline compatibility.
- First send returns the promoted conversation detail, so `/draft/:draftId` can navigate to `/conversation/:conversationId` from the endpoint result.
- Queue admission stores the admitted request and queued item while a conversation is busy; full queue execution/reorder/pause UI stays in Phase 5.
- Added pure main validation regressions for valid admitted bodies, injected native paths, matched file refs, and queue status updates. SQLite-backed controller persistence tests were not added because the repo's `better-sqlite3` binary is currently built for Electron's Node ABI and fails under Node Vitest; keep DB persistence covered by build/type gates until an Electron/Vitest DB harness exists.

## Phase 5 — Queue From Beginning

Goal: queue is core behavior, not a later patch.

Add:

```txt
src/renderer/components/composer/core/composerQueueStore.ts
src/renderer/components/composer/ComposerQueuePanel.tsx
src/main/conversations/queue.ts
```

Behavior:

- If conversation is busy, admit to queue if enabled.
- If queue disabled, block with clear busy state.
- Queue item stores draft snapshot, request parts, admission result, provider target, validation status.
- Edit/remove/reorder/clear/pause/resume.
- Execute only when route/runtime gate is ready.
- Revalidate before execution.

Initial limits:

- max queued sends: 20.
- max input length: 20,000.
- max serialized queue state: 256 KB.

Tests/gates:

- Queue admission while busy.
- Queue rejection for invalid attachment.
- Pause/resume.
- Revalidation rejects stale unsafe path.
- Typecheck/build.

Done:

- Queue works for Codex path.
- Queue state appears in timeline or composer region.

## Phase 6 — Quick Capture

Goal: studio operations intake exists as first-class workflow.

Add:

```txt
src/renderer/routes/capture.tsx
src/renderer/capture/quickCaptureStore.ts
src/renderer/capture/QuickCaptureView.tsx
src/main/capture/controller.ts
```

Capture targets:

- note
- task
- reminder
- calendar item
- client/project/shoot/deliverable reference
- file/context attachment
- later Stuwiz API sync

Rules:

- Quick capture can create an app action without provider runtime.
- It can optionally create or append to a conversation.
- It uses shared request parts and main validation for attachments.

Tests/gates:

- Create local quick capture.
- Attach file safely.
- Convert capture to conversation/action.
- Typecheck/build.

Done:

- Everyday app path exists before UI polish.

## Phase 7 — Timeline Projection And Renderer

Goal: replace text-only `SessionPanel`.

Add:

```txt
src/renderer/conversations/conversationTimelineModel.ts
src/renderer/components/conversation/ConversationStage.tsx
src/renderer/components/conversation/ConversationTimeline.tsx
src/renderer/components/conversation/TimelineRow.tsx
src/renderer/components/conversation/PendingRequestLayer.tsx
src/renderer/components/conversation/ConversationStatusBar.tsx
```

Rows:

- user message.
- assistant message.
- streaming delta.
- file/image/context part.
- approval/request.
- queued item.
- tool/command.
- app action.
- quick capture.
- compaction.
- error.

Tasks:

- Project DB detail + live events into timeline rows.
- Render pending approvals outside text transcript.
- Keep `SessionPanel` only as temporary debug view if needed.
- Add attachment/image rendering from persisted message parts.

Tests/gates:

- Projection tests for row types.
- Component smoke tests if available.
- Typecheck/build.

Done:

- Timeline renders message parts, not text-only transcript.

## Phase 8 — Provider Expansion Foundation

Goal: Codex remains first, but architecture is ready.

Add adapter stubs:

```txt
src/renderer/components/composer/adapters/opencodeComposerAdapter.ts
src/renderer/components/composer/adapters/acpComposerAdapter.ts
src/renderer/components/composer/adapters/apiChatComposerAdapter.ts
```

Tasks:

- Keep stubs non-runtime until provider implementation starts.
- Add capability records for OpenCode, ACP, API chat.
- Add mode policy tests for provider differences.
- Keep shell blocked unless provider capability explicitly allows it.

Done:

- Adding another provider means adding an adapter/capability branch, not rewriting composer.

## Phase 9 — Editor And Polish

Goal: improve interaction only after architecture is stable.

Tasks:

- Add highlight overlay for mentions/slash/skill/terminal tokens.
- Revisit Lexical vs contenteditable only after parser/draft/send/timeline tests exist.
- Add keyboard and IME tests where possible.
- Add virtualization if timelines need it.

Done:

- UI richness builds on stable domain parts.

## Final Validation Gate

Before handoff:

- `pnpm --filter @repo/experimental-desktop type-check` or repo equivalent.
- `pnpm --filter @repo/experimental-desktop build` or repo equivalent.
- targeted tests for composer request parts, admission, queue, projection, main validation.
- manual smoke: draft route -> first send -> conversation route -> follow-up -> queue -> approval -> attachment render -> quick capture.

## Implementation Order Summary

```txt
0. Router/app shell.
1. DB/domain schema.
2. Conversation client/projection stores.
3. Route-scoped composer domain.
4. Admitted send endpoints.
5. Queue.
6. Quick capture.
7. Timeline renderer.
8. Provider expansion foundation.
9. Editor/polish.
```

Ship the spine first. Then make it beautiful.
