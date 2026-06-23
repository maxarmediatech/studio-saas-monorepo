# Composer + Conversation Master Plan

Final source of truth for the experimental desktop composer/conversation architecture.

```txt
Created: 2026-06-23
Owner: Rakesh
Current app: /Users/rakesh/Developer/agency/studio-saas-monorepo/apps/experimental-desktop
```

## Document Status

Use these:

- `docs/COMPOSER_CONVERSATION_MASTER_PLAN.md`: product + architecture source of truth.
- `docs/COMPOSER_CONVERSATION_EXECUTION_CHECKLIST.md`: implementation order and gates.
- `docs/COMPOSER_PARITY_IMPLEMENTATION_PLAN.md`: composer-domain companion plan for request parts, admission, provider adapters, mode policy, draft sync, and queue.
- `../COMPOSER_CONVERSATION_FLOW_REFERENCE_MAP.md`: evidence map from current app, AionUI, T3Code, and OpenCode.
- `../COMPOSER_PARITY_REFERENCE_MAP.md`: composer-specific evidence map.

Do not use these as implementation plans:

- `../COMPOSER_PARITY_CHECKLIST.md`: superseded original checklist.
- `../COMPOSER_PARITY_REVIEWED.md`: useful review snapshot, but superseded by this master plan and the corrected implementation plan.
- `../COMPOSER_CONVERSATION_FLOW_ARCHITECTURE.md`: superseded planning draft. Keep only as historical notes.

## Product Direction

This is not just a coding chat app. The desktop app is a companion for the Stuwiz web app and studio operations.

It must support:

- Studio website/code work through Codex first.
- Local file-system context and safe local attachments.
- Stuwiz operational work: clients, shoots, deliverables, notes, reminders, calendars, tasks, project context, and quick capture.
- Future providers and runtimes: Codex, OpenCode, ACP-style backends, and API chat providers.
- Future app actions that may not be chat at all.

The composer is the everyday command surface. The conversation system is the durable workspace where user intent, provider/runtime output, files, actions, approvals, and follow-ups become visible and recoverable.

## Architecture Principles

Do not optimize for the easiest migration. Optimize for clean seams that survive provider changes and product expansion.

Adopt the best ideas from the three reference apps:

```txt
OpenCode: draft -> request parts -> admitted input -> transport -> projector -> timeline.
T3Code: draft route vs persisted thread route, provider-instance state, rich draft persistence.
AionUI: route-owned conversation identity, shell/sidebar separation, backend capability policy.
```

Core rules:

- Route owns identity.
- Layout owns shell.
- Conversation resource owns persisted data.
- Event store owns live stream updates.
- Projection owns timeline state.
- Composer draft owns editable input.
- Admission owns request creation and validation.
- Main process owns durable state and provider runtime handoff.
- Provider-native shapes stay inside adapters.
- Main validates everything again, even if renderer already checked it.

## Routing Decision

Use TanStack Router.

Reason:

- T3Code proves the draft-thread vs persisted-thread route model works well with typed routes.
- The app is expected to grow beyond a simple chat page.
- Typed params and route-owned loaders/state will help when Stuwiz entities, quick capture, operations views, and future providers appear.

Target route shape:

```txt
/                                      landing/empty redirect surface
/draft/:draftId                         editable unsent draft route
/conversation/:conversationId           persisted conversation route
/capture                                global quick-capture route or overlay host
```

Route meanings:

- `/draft/:draftId` is an editable pre-conversation workspace.
- `/conversation/:conversationId` is durable conversation state from DB.
- `/capture` is for quick capture and studio ops intake. It can later become a modal route or global overlay, but its state must not be hacked into `App.tsx`.

## App Composition

Target renderer shell:

```txt
RendererRoot
  -> AppProviders
      -> TanStackRouter
          -> DesktopLayout
              -> ConversationSidebar
              -> RouteOutlet
              -> RightInspector
              -> QuickCaptureHost
```

`App.tsx` should become providers + router bootstrapping only. It should not own composer text, active conversation, draft debounce, transcript projection, or send behavior.

## Route Responsibilities

Draft route:

```txt
DraftConversationRoute
  -> DraftConversationResource(draftId)
  -> ComposerDraftStore(scope=draftId)
  -> ComposerDraftSync
  -> ConversationStage
      -> DraftTimelinePlaceholder
      -> ComposerRegion
```

Responsibilities:

- Create or hydrate draft.
- Own selected workspace and operational context for that draft.
- Persist draft snapshots.
- Admit first send.
- Promote draft into conversation.
- Navigate to `/conversation/:conversationId` after promotion.
- Clear draft only after admission + promotion succeeds.

Conversation route:

```txt
ConversationRoute
  -> ConversationResource(conversationId)
  -> ConversationEventSubscription(conversationId)
  -> ConversationProjectionProvider
  -> ConversationStage
      -> ConversationTimeline
      -> PendingRequestLayer
      -> ComposerRegion
```

Responsibilities:

- Load conversation detail by route id.
- Subscribe/unsubscribe by route id.
- Project messages, parts, events, approvals, and live deltas.
- Continue conversation through admitted requests.
- Maintain per-conversation unsent draft.
- Handle missing conversations at route level.

## Composer Domain

Use `COMPOSER_PARITY_IMPLEMENTATION_PLAN.md` as the companion implementation plan.

Shared composer domain:

```txt
ComposerDraft
ComposerRequestPart[]
ComposerAdmissionResult
AdmittedComposerRequest
ProviderSendInput union
RuntimeCapabilityMap
ComposerQueueStore
```

The stable center is `ComposerRequestPart[]`, not Codex `nativeInput`, not text-only prompts, and not provider payloads.

Provider adapter branches:

```txt
CodexProviderSendInput       first implemented branch
OpenCodeProviderSendInput    planned branch
AcpProviderSendInput         planned branch for Claude/Cursor/Gemini/Qwen/Aion-style backends
ApiChatProviderSendInput     planned branch for API chat models and non-agent assistants
```

Shell mode is tracked but blocked until capability policy and provider-specific shell execution are solid.

## Main Process Domain

Do not defer DB design. Add schema and types now for the real product shape.

Target durable concepts:

```txt
drafts
conversations
conversation_entities
admitted_requests
provider_sessions
turns
messages
message_parts
events
approvals
queue_items
quick_captures
conversation_summaries
```

`message_parts` must support richer rows from the beginning:

```txt
text
file_ref
image_ref
folder_ref
context_ref
tool_call
tool_result
approval
diff
app_action
quick_capture
system_event
compaction
error
raw
```

Main validation must check:

- admitted request identity and idempotency.
- route endpoint vs request conversation/draft id.
- provider payload matches admitted request parts.
- local paths normalize safely and exist where required.
- runtime/mode is allowed by selected provider capabilities.
- conversation can accept a new turn.
- queued item is still valid at execution time.

## Queue From The Beginning

Queue is part of the core model, not a later bolt-on.

Initial rules:

- Busy conversation can admit queue item if queue is enabled.
- Queue item stores draft snapshot, request parts, admission result, provider target, and validation state.
- Queue execution revalidates before provider handoff.
- User can edit, remove, reorder, pause, resume, and clear queue items.
- Queue belongs to draft/conversation scope, not global app state.

## Quick Capture

Quick capture is a first-class everyday app surface.

It should support:

- note
- task
- reminder
- calendar item
- client/project/shoot/deliverable reference
- file/context attachment
- later: Stuwiz API sync

Quick capture should use the same request/admission/storage foundation, but it does not need to start a coding provider turn. It may create a `quick_capture`, a conversation, an app action, or a Stuwiz operation depending on target.

## Timeline And Projection

Timeline renders projection, not raw stream strings.

Target projection:

```txt
ConversationDetail
+ message_parts
+ pending approvals
+ live events
+ queue state
-> ConversationTimelineModel
-> TimelineRow[]
```

Initial timeline rows:

- user message
- assistant message
- streaming delta
- file/image/context part
- approval/request row
- queued item row
- tool/command row
- app action row
- quick capture row
- compaction row
- error row

`SessionPanel` can remain temporarily as a debug compatibility renderer only. It is not the long-term conversation UI.

## Dependency Decisions

Add dependencies when they buy durable architecture.

Approved:

- TanStack Router for typed route ownership.
- A focused state/store helper if it materially reduces route/resource/projection boilerplate.
- Virtualization later if timeline size requires it.

Do not add a rich editor dependency until request parts, draft sync, admission, queue, and timeline projection are stable.

## Migration Position

Current data does not need to be preserved. This is not yet a real app.

Allowed:

- schema reset/migration for correct tables.
- replacing `useCodexSession.ts` instead of preserving it.
- breaking draft records.
- deleting compatibility once replacement is in place.

Still required:

- small safe steps.
- tests around promote/send/queue/admission.
- no renderer infinite loops.
- no provider handoff without main-side validation.

## Done Criteria

This architecture is working when:

- `App.tsx` is providers/router/layout only.
- TanStack routes own draft/conversation identity.
- `/draft/:draftId` and `/conversation/:conversationId` have distinct lifecycles.
- First send promotes draft and navigates to conversation route.
- Follow-up sends do not depend on global App composer state.
- Quick capture exists as a first-class surface.
- Queue exists from the first real send architecture.
- Composer sends admitted requests, not loose payloads.
- Main validates admitted requests before runtime handoff.
- Timeline renders projected message parts, not hand-built transcript rows.
- `useCodexSession.ts` is removed or reduced to a temporary compatibility shim.
- Rich message parts and provider envelopes are persisted in DB.
- Codex works first without blocking future OpenCode/ACP/API providers.

Final call: build the route/conversation/admission/storage spine first. UI polish and rich editor come after the spine is boring, durable, and provider-neutral.
