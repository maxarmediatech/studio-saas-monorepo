# Composer + Conversation Flow Reference Map

Reference companion to `COMPOSER_CONVERSATION_FLOW_ARCHITECTURE.md`.

```txt
Current app: /Users/rakesh/Developer/agency/studio-saas-monorepo/apps/experimental-desktop
AionUI:     /Users/rakesh/Developer/AionUi
T3Code:     /Users/rakesh/Developer/t3code
OpenCode:   /Users/rakesh/Developer/opencode
Created:    2026-06-23
```

## Current App Files Checked

Renderer:

```txt
src/renderer/main.tsx
src/renderer/app/App.tsx
src/renderer/hooks/useCodexSession.ts
src/renderer/components/composer/SessionComposer.tsx
src/renderer/components/session.tsx
src/renderer/app/types.ts
```

Preload/main:

```txt
src/preload/types.ts
src/preload/index.ts
src/main/storage/database.ts
src/main/conversations/types.ts
src/main/conversations/repository.ts
src/main/conversations/controller.ts
src/main/conversations/controller-utils.ts
src/main/ipc.ts
src/main/sidecar-codex-input.ts
src/main/composer-image-normalizer.ts
```

Current app observations:

```txt
App.tsx owns composer state and app shell.
useCodexSession owns transport, draft persistence, projection, send, and event subscription.
SessionComposer builds ComposerPayload.
SessionPanel renders flat TranscriptItem rows.
Main repository already has durable draft/conversation/turn/message/part/event/approval concepts.
Main controller already has promoteDraftAndSend and sendConversationMessage flows.
```

Key current split:

```txt
Renderer state is too centralized and ad-hoc.
Main state is more domain-shaped but receives loose send input.
```

## AionUI Reference

Files checked:

```txt
packages/desktop/src/renderer/main.tsx
packages/desktop/src/renderer/components/layout/Router.tsx
packages/desktop/src/renderer/components/layout/Layout.tsx
packages/desktop/src/renderer/pages/conversation/index.tsx
packages/desktop/src/renderer/pages/conversation/components/ChatConversation.tsx
packages/desktop/src/renderer/pages/conversation/platforms/acp/AcpChat.tsx
packages/desktop/src/renderer/pages/conversation/platforms/acp/AcpSendBox.tsx
packages/desktop/src/renderer/pages/conversation/platforms/acp/useAcpMessage.ts
packages/desktop/src/renderer/pages/conversation/Messages/MessageList.tsx
packages/desktop/src/renderer/pages/conversation/GroupedHistory/hooks/useConversationListSync.ts
packages/desktop/src/renderer/hooks/context/ConversationHistoryContext.tsx
packages/desktop/src/renderer/hooks/context/ConversationContext.tsx
```

Structure:

```txt
HashRouter
  -> protected Layout
      -> /conversation/:id
          -> route fetches conversation
          -> ChatConversation chooses platform/runtime view
          -> platform chat wraps MessageList provider + SendBox wrapper
          -> message hook listens to runtime stream
          -> grouped history sync owns sidebar state
```

Useful ideas:

- route owns conversation id
- layout owns shell/sidebar/content outlet
- conversation page fetches and validates conversation
- platform chat wraps generic message list + backend sendbox
- conversation history has separate sync context
- stream state is separate from route state
- mobile/desktop layout state is separate from conversation domain state

Do not copy:

- giant SendBox component shape
- broad file acceptance behavior
- too much stream-handling inside sendbox wrappers

## T3Code Reference

Files checked:

```txt
apps/web/src/router.ts
apps/web/src/routes/__root.tsx
apps/web/src/routes/_chat.tsx
apps/web/src/routes/_chat.index.tsx
apps/web/src/routes/_chat.draft.$draftId.tsx
apps/web/src/routes/_chat.$environmentId.$threadId.tsx
apps/web/src/threadRoutes.ts
apps/web/src/threadSelectionStore.ts
apps/web/src/components/ChatView.tsx
apps/web/src/components/chat/ChatComposer.tsx
apps/web/src/components/chat/MessagesTimeline.tsx
apps/web/src/composerDraftStore.ts
apps/web/src/state/threads.ts
```

Structure:

```txt
root route
  -> chat layout route
      -> index empty state
      -> /draft/$draftId
      -> /$environmentId/$threadId
          -> ChatView
              -> MessagesTimeline
              -> ChatComposer
              -> pending panels / side panels / terminal / preview
```

Useful ideas:

- draft route and persisted thread route are separate
- route resolves whether target is draft or started thread
- route utilities isolate URL params from domain ids
- draft promotion finalization is explicit
- ChatView composes timeline, composer, pending panels, side panels
- local dispatch snapshot handles optimistic/in-flight state
- thread selection store is separate from active route data

Do not copy:

- huge ChatView as destination architecture
- all web/mobile environment complexity
- putting every runtime side panel into one file

## OpenCode Reference

Files checked:

```txt
packages/app/src/pages/new-session.tsx
packages/app/src/pages/session.tsx
packages/app/src/pages/session/session-layout.ts
packages/app/src/pages/session/composer/session-composer-region.tsx
packages/app/src/pages/session/composer/session-composer-state.ts
packages/app/src/pages/session/timeline/message-timeline.tsx
packages/app/src/context/prompt.tsx
packages/app/src/components/prompt-input/submit.ts
packages/app/src/components/prompt-input/build-request-parts.ts
packages/core/src/session/input.ts
packages/core/src/session/prompt.ts
packages/core/src/session/projector.ts
packages/core/src/session/message.ts
```

Structure:

```txt
/new-session
  -> composer-only new session page
  -> submit creates/promotes session
  -> navigate to real session route

/session/:id
  -> session layout key
  -> timeline model/projection
  -> composer region
  -> prompt input
  -> permission/question/followup/revert/todo docks
```

Domain flow:

```txt
Prompt state
-> build request parts
-> admitted session input
-> session events
-> projector writes session/message/part projections
-> timeline renders projection
```

Useful ideas:

- separate new-session page
- prompt context scoped by draft/session/workspace
- deterministic request part builder
- optimistic send and rollback in submit flow
- separate shell branch
- session input admission as a backend concept
- event projector writes message/part projections
- timeline renders projection, not raw stream strings
- composer region owns docks around prompt

Do not copy:

- SolidJS component patterns
- implicit auto-accept without explicit risk UI
- direct prompt input component shape

## Cross-Repo Pattern

The references converge on the same separation:

```txt
route owns identity
layout owns shell
conversation resource owns persisted data
stream/event store owns live updates
projection owns timeline state
composer draft owns editable input
send/admission owns request creation
main/backend owns durable state and provider runtime
```

Our app currently compresses too many of those into `App.tsx` and `useCodexSession.ts`.

## Copy Order

Recommended order:

```txt
1. T3Code/OpenCode route split idea: /new draft vs /conversation/:id persisted route.
2. AionUI layout/router/sidebar separation.
3. OpenCode prompt/admitted input/projector model.
4. Current main repository concepts: keep and expose cleaner admitted endpoints.
5. AionUI/T3Code message/timeline rendering ideas after route/data seams are stable.
```

## Main Takeaway

Do not make composer the top-level app state. Make it a route-scoped region inside a conversation workflow.

The correct hierarchy is:

```txt
App shell
-> route
-> conversation resource/projection
-> timeline
-> composer region
-> send admission
-> main storage/runtime
```
