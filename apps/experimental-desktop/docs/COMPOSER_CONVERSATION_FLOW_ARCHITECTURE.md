# Composer + Conversation Flow Architecture

Workflow plan. Repo evidence lives in `COMPOSER_CONVERSATION_FLOW_REFERENCE_MAP.md`.

```txt
Current app: /Users/rakesh/Developer/agency/studio-saas-monorepo/apps/experimental-desktop
Created: 2026-06-23
```

## Core Problem

Composer bugs are not isolated to the composer element. The real lifecycle is:

```txt
route/app shell -> conversation selection -> draft lifecycle -> composer state
-> send admission -> main validation -> DB conversation/turn/message records
-> provider runtime -> streamed events -> renderer projection
-> conversation rendering -> navigation/restoration
```

Current renderer shape:

```txt
main.tsx -> App -> TopBar / Sidebar / SessionComposer / SessionPanel / RightPanel
```

There is no real route layer. `App.tsx` owns shell, active conversation state, selected folder, model, runtime mode, message text, context items, attachments, and draft persistence trigger.

`useCodexSession.ts` owns too much: conversation list refresh, active id, thread id, status string, transcript projection, pending request state, event log, draft persistence IPC, provider input building, send/continue flow, subscribe/unsubscribe, event handling, interrupt, and request responses.

`SessionPanel` is too low fidelity: flat text-only transcript rows, duplicated approval rendering, no message parts, no image/file/context rendering, and no turn-aware rendering.

The main process is better shaped than the renderer. It already has durable concepts:

```txt
drafts, conversations, provider_sessions, turns, messages, message_parts,
events, approvals, conversation_summaries
```

The fix is not “make composer prettier.” The fix is to place composer inside a route-owned conversation workflow.

## Current Flow To Replace

First message today:

```txt
App owns message/context/attachments/mode
-> SessionComposer builds ComposerPayload
-> App calls useCodexSession.sendMessage
-> useCodexSession builds provider input
-> useCodexSession calls promoteDraftAndSend
-> main promotes draft into conversation/turn/messages
-> main starts Codex runtime
-> events broadcast
-> useCodexSession mutates TranscriptItem[]
-> SessionPanel renders text rows
```

Follow-up today:

```txt
SessionComposer builds ComposerPayload
-> useCodexSession.sendMessage
-> buildComposerProviderInput
-> sendConversationMessage IPC
-> main creates turn + user/assistant placeholders
-> runtime starts/resumes
-> events stream back
-> useCodexSession mutates transcript
```

## Reference Lessons

AionUI: route owns conversation id, layout owns shell/sidebar/content outlet, route fetches conversation, platform chat wraps message list + sendbox, and sidebar/history sync is separate.

T3Code: draft route is not the same as persisted thread route. Promotion is explicit and navigation follows promotion.

OpenCode: new-session page -> prompt state -> request parts -> admitted session input -> session events -> projector writes message/part projections -> timeline renders projection.

Shared pattern:

```txt
route owns identity
layout owns shell
conversation resource owns persisted data
stream/event store owns live updates
projection owns timeline state
composer draft owns editable input
send/admission owns request creation
main owns durable state and provider runtime
```

## Target Routes

Add a route layer:

```txt
/                         redirect to /new or empty state
/new                      new conversation draft route
/conversation/:id         persisted conversation route
```

Target shell:

```txt
RendererRoot
  -> AppProviders
      -> AppRouter
          -> DesktopLayout
              -> ConversationSidebar
              -> RouteOutlet
              -> RightInspector
```

`App.tsx` becomes providers + router + layout only.

## New Conversation Route

```txt
NewConversationRoute
  -> DraftConversationProvider(scope="new")
  -> ConversationStage
      -> EmptyTimeline / welcome surface
      -> ComposerRegion
```

Responsibilities: create/hydrate draft, own selected workspace, own unsent composer state through `ComposerDraftStore`, persist through `ComposerDraftSync`, send through `ComposerSendController`, and after first-send promotion navigate to `/conversation/:conversationId`.

No provider runtime starts before admission succeeds.

## Conversation Route

```txt
ConversationRoute
  -> ConversationResource(conversationId)
  -> ConversationEventSubscription(conversationId)
  -> ConversationProjectionProvider
  -> ConversationStage
      -> ConversationTimeline
      -> ComposerRegion
      -> PendingRequestLayer
```

Responsibilities: load `ConversationDetail`, subscribe by route id, project messages/events/approvals into UI state, render timeline rows, maintain per-conversation unsent draft, continue through admitted send request, and unsubscribe on route change.

Missing conversations are handled by the route, not global app state.

## Sidebar

```txt
ConversationSidebar
  -> ConversationHistoryProvider
      -> grouped summaries
      -> active route marker
      -> running/completed/unread markers
      -> create/open/archive/delete actions
```

Sidebar actions navigate only:

```txt
open conversation -> navigate('/conversation/:id')
new conversation -> navigate('/new')
```

## Composer Placement

Composer lives inside the active route, not globally in `App.tsx`.

```txt
ComposerRegion
  -> PendingRequestDocks
  -> ComposerView
      -> ComposerEditor/Textarea
      -> ComposerToolbar
      -> ComposerContextBudget
      -> ComposerAttachmentStrip
      -> ComposerQueuePanel
```

`ComposerRegion` receives route/session context: `conversationId?`, `conversationStatus`, `providerCapabilities`, `workspaceRoot`, and `pendingRequests`. It does not receive raw global App state.

## State Ownership

Renderer state:

```txt
RouteState                 route params only
ConversationHistoryStore   sidebar summaries + active markers
ConversationResourceStore  loaded ConversationDetail per id
ConversationEventStore     live event stream per active route
ConversationProjection     timeline rows, pending docks, status
ComposerDraftStore         editable draft by scope
ComposerDraftSync          hydrate/debounce/clear draft snapshot
ComposerSendController     admission + send orchestration
RuntimeStatusStore         active turn/busy/canceling state
```

Main state:

```txt
ConversationController     promote/continue/interrupt/respond
ConversationRepository     DB reads/writes
ConversationProjector      provider events -> messages/parts/events/approvals
ProviderRuntimeBridge      starts/resumes threads and turns
NativeAttachmentValidator  validates admitted native attachments before provider handoff
```

## First Message Workflow

```txt
/new route mounted
-> DraftConversationProvider hydrates draft snapshot
-> user edits composer
-> ComposerDraftStore updates live draft
-> ComposerDraftSync persists snapshot
-> user sends
-> ComposerSendController receives draft snapshot
-> ComposerModePolicy derives effective runtime
-> ComposerRequestParts builds provider-agnostic request
-> renderer admission checks run
-> ProviderAdapter builds ProviderSendInput
-> controller creates AdmittedComposerRequest
-> renderer transport calls main promoteDraftAndSendAdmitted
-> main validates admitted request
-> main promotes draft into conversation/turn/messages
-> main broadcasts message.created
-> renderer navigates to /conversation/:conversationId
-> main starts provider thread/turn
-> runtime events stream
-> main persists events/message parts/approvals
-> renderer event subscription updates projection
-> ConversationTimeline renders message stream
-> ComposerDraftSync clears promoted draft
```

Invariant: draft clears only after admission/promotion succeeds.

## Follow-Up Workflow

```txt
/conversation/:id route mounted
-> load ConversationDetail
-> subscribe events
-> hydrate per-conversation draft
-> user sends
-> ComposerSendController admits request
-> renderer transport calls main sendConversationAdmitted
-> main validates conversation can accept turn
-> main validates admitted request
-> main creates turn + user/assistant placeholder messages
-> main broadcasts message.created
-> main resumes or replays provider thread
-> runtime events persist/project
-> timeline updates from projection
-> draft clears only after admission succeeds
```

Busy behavior:

```txt
queue enabled -> ComposerQueueStore admits queued item
queue disabled -> block with clear busy state
```

## Rendering Workflow

Timeline should render projected message parts, not text-only transcript rows.

```txt
ConversationDetail.messages + message_parts + pending approvals + live events
-> ConversationTimelineModel
-> TimelineRow[]
```

Timeline row types: user message, assistant message, assistant streaming delta, file/image attachment part, context part, approval/request row, tool/command row, system event row, compaction row, error row.

Initial implementation can render simple text, but the architecture must not force text-only rendering.

## Navigation Rules

```txt
/new always means editable unsent draft
/conversation/:id always means persisted conversation
sidebar open uses navigation only
first send from /new promotes then navigates
missing conversation is route-level not-found
active turn in another route updates history markers
active route owns its event subscription
```

## Main Admission Contract

Renderer sends an explicit admitted request, not loose composer payload.

```ts
export type AdmittedComposerRequest = {
  id: string;
  conversationId?: string;
  draftId?: string;
  payloadSnapshot: ComposerPayload;
  requestParts: ComposerRequestPart[];
  providerInput: ProviderSendInput;
  admission: ComposerAdmissionResult;
};
```

Target main endpoints:

```txt
promoteDraftAndSendAdmitted(request)
sendConversationAdmitted(conversationId, request)
```

Main validates request identity, endpoint/conversation match, admitted request parts, native attachments against admitted parts, runtime mode against mode/provider policy, and conversation availability for a new turn.

## Implementation Phases

## Phase A — Route And Composition Skeleton

Add:

```txt
src/renderer/app/AppRouter.tsx
src/renderer/app/DesktopLayout.tsx
src/renderer/routes/NewConversationRoute.tsx
src/renderer/routes/ConversationRoute.tsx
src/renderer/routes/EmptyStateRoute.tsx
```

Move from `App owns everything` to `App -> providers/router/layout only`.

## Phase B — Conversation Client Layer

Add:

```txt
src/renderer/conversations/conversationClient.ts
src/renderer/conversations/conversationHistoryStore.ts
src/renderer/conversations/conversationResourceStore.ts
src/renderer/conversations/conversationEventStore.ts
src/renderer/conversations/conversationProjection.ts
src/renderer/conversations/useConversationRoute.ts
```

Move list/get/subscribe/event dedupe/transcript projection/pending request derivation/status derivation out of `useCodexSession.ts`.

## Phase C — Composer Inside Route

Add `src/renderer/components/composer/ComposerRegion.tsx`.

`ComposerRegion` talks to `ComposerDraftStore`, `ComposerDraftSync`, `ComposerSendController`, and `ConversationTransport`, not global `App.tsx` state.

## Phase D — Main Admission Endpoints

Move toward:

```txt
conversation:promote-draft-and-send-admitted
conversation:send-admitted-message
```

Main validates admitted request shape before touching runtime.

## Phase E — Timeline Rendering

Add:

```txt
src/renderer/conversations/conversationTimelineModel.ts
src/renderer/components/conversation/ConversationTimeline.tsx
src/renderer/components/conversation/TimelineRow.tsx
src/renderer/components/conversation/PendingRequestLayer.tsx
```

`SessionPanel` can remain temporarily as a debug/simple renderer, but not as the long-term conversation renderer.

## Target File Structure

```txt
src/renderer/app/
  App.tsx
  AppRouter.tsx
  DesktopLayout.tsx
  providers.tsx
src/renderer/routes/
  NewConversationRoute.tsx
  ConversationRoute.tsx
  EmptyStateRoute.tsx
src/renderer/conversations/
  conversationClient.ts
  conversationHistoryStore.ts
  conversationResourceStore.ts
  conversationEventStore.ts
  conversationProjection.ts
  conversationTimelineModel.ts
  conversationTransport.ts
  useConversationRoute.ts
src/renderer/components/conversation/
  ConversationStage.tsx
  ConversationTimeline.tsx
  TimelineRow.tsx
  PendingRequestLayer.tsx
  ConversationStatusBar.tsx
src/main/conversations/
  admitted-request.ts
  native-attachment-validation.ts
  projector.ts
```

## Priority Order

P0: add route skeleton without changing runtime behavior; split `useCodexSession` into client/resource/event/projection pieces; move composer into route-owned `ComposerRegion`; add tests around current promote/send behavior.

P1: add `ComposerSendController` and admitted request contract; update renderer transport to send admitted requests; add main admitted-native-attachment validation; keep old IPC wrappers temporarily if needed.

P2: add explicit `/new` draft route and `/conversation/:id` route; draft promotion navigates to conversation route; per-conversation unsent draft sync; sidebar navigation uses routes only.

P3: replace flat transcript with timeline model; render message parts; split pending request layer from transcript rows.

P4: queue support; branch/fork/tree route support; richer timeline virtualization if needed; rich editor/highlight overlay.

## Done Criteria

This pass is successful when:

- `App.tsx` is mostly providers/layout/router.
- `/new` and `/conversation/:id` have separate lifecycles.
- first send promotes a draft then navigates to persisted conversation route.
- follow-up sends never depend on global App composer state.
- `useCodexSession.ts` is deleted or reduced to a thin compatibility wrapper.
- sidebar state is independent of active conversation detail state.
- active conversation event subscription is route-scoped and cleaned up on navigation.
- renderer projection is separate from event subscription.
- timeline renders from projected messages/parts, not hand-built text-only transcript state.
- composer lives inside route-owned `ComposerRegion`.
- main validates admitted request before provider handoff.
- image/file attachments survive the full route/send/store/render cycle.

Final call: fix where composer lives, what route owns it, how a draft becomes a conversation, how sends are admitted, how storage is projected, and how the timeline renders.
