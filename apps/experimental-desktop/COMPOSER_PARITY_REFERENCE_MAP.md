# Composer Parity Reference Map

Reference companion to `COMPOSER_PARITY_IMPLEMENTATION_PLAN.md`.

This file keeps reference-copy notes separate so the implementation plan stays focused and under the working LOC constraint.

```txt
Current app: /Users/rakesh/Developer/agency/studio-saas-monorepo/apps/experimental-desktop
AionUI:     /Users/rakesh/Developer/AionUi
T3Code:     /Users/rakesh/Developer/t3code
OpenCode:   /Users/rakesh/Developer/opencode
Created:    2026-06-23
```

## Current App Files To Keep Watching

```txt
src/renderer/app/App.tsx
src/renderer/hooks/useCodexSession.ts
src/renderer/components/composer/SessionComposer.tsx
src/renderer/components/composer/composerPayload.ts
src/renderer/components/composer/composerProviderInput.ts
src/renderer/components/composer/useComposerAttachments.ts
src/renderer/components/composer/useComposerContextItems.ts
src/renderer/components/composer/useComposerFileDrop.ts
src/renderer/components/composer/useComposerHistory.ts
src/renderer/components/composer/composerTriggers.ts
src/renderer/components/composer/useWorkspaceFileMentions.ts
src/main/conversations/controller.ts
src/main/sidecar-codex-input.ts
src/main/composer-image-normalizer.ts
src/main/ipc-attachments.ts
src/shared/composerAttachmentPolicy.ts
```

Key current issue:

```txt
SessionComposer builds ComposerPayload.
useCodexSession builds provider input and sends.
App persists drafts with debounce.
Main DB stores draft snapshots.
```

The plan should collapse send admission into one renderer controller and route durable persistence through one draft sync seam.

---

## AionUI Reference

Important local files:

```txt
packages/desktop/src/renderer/components/chat/SendBox/index.tsx
packages/desktop/src/renderer/utils/chat/atFileQuery.ts
packages/desktop/src/renderer/hooks/chat/useSendBoxDraft.ts
packages/desktop/src/renderer/hooks/chat/useCompositionInput.ts
packages/desktop/src/renderer/hooks/chat/useSlashCommandController.ts
packages/desktop/src/renderer/hooks/chat/useSlashCommands.ts
packages/desktop/src/renderer/pages/conversation/platforms/useConversationCommandQueue.ts
packages/desktop/src/renderer/utils/model/agentModes.ts
packages/desktop/src/renderer/components/agent/ContextUsageIndicator.tsx
packages/desktop/src/renderer/hooks/file/useUploadState.ts
packages/desktop/src/renderer/hooks/file/usePasteService.ts
```

Copy/adapt first:

```txt
utils/chat/atFileQuery.ts
hooks/chat/useCompositionInput.ts
hooks/chat/useSlashCommandController.ts
hooks/chat/useSlashCommands.ts
pages/conversation/platforms/useConversationCommandQueue.ts
utils/model/agentModes.ts
components/agent/ContextUsageIndicator.tsx
```

Use for:

- escaped path parsing
- IME-safe keyboard handling
- dynamic slash command loading
- queue limits and runtime gate
- provider mode mapping
- context usage UI
- upload lifecycle ownership pattern

Avoid:

```txt
SendBox/index.tsx as a copied component
broad file acceptance behavior
string-marker context as primary protocol
```

Reason:

AionUI has useful utilities and state patterns, but its SendBox is too large and mixed to copy as a component.

---

## T3Code Reference

Important local files:

```txt
apps/web/src/components/chat/ChatComposer.tsx
apps/web/src/components/ComposerPromptEditor.tsx
apps/web/src/composer-logic.ts
apps/web/src/composer-editor-mentions.ts
apps/web/src/composerDraftStore.ts
apps/web/src/pendingUserInput.ts
apps/web/src/components/chat/ContextWindowMeter.tsx
packages/shared/src/composerTrigger.ts
packages/shared/src/composerInlineTokens.ts
packages/client-runtime/src/state/composerPathSearch.ts
```

Important tests:

```txt
apps/web/src/composer-logic.test.ts
apps/web/src/composer-editor-mentions.test.ts
apps/web/src/composerDraftStore.test.ts
apps/web/src/pendingUserInput.test.ts
apps/web/src/composerSlashCommandSearch.test.ts
apps/web/src/composerProviderState.test.tsx
apps/web/src/components/chat/ComposerPrimaryActions.test.ts
apps/web/src/components/chat/ComposerPendingTerminalContexts.test.tsx
apps/web/src/components/chat/ComposerPreviewAnnotationCards.test.tsx
packages/shared/src/composerTrigger.test.ts
packages/shared/src/composerInlineTokens.test.ts
```

Copy/adapt first:

```txt
packages/shared/src/composerTrigger.ts
packages/shared/src/composerInlineTokens.ts
apps/web/src/composer-logic.ts
apps/web/src/composer-editor-mentions.ts
apps/web/src/pendingUserInput.ts
apps/web/src/components/chat/ContextWindowMeter.tsx
```

Use for:

- cursor mapping concepts
- inline token parsing
- quoted file path serialization
- mention boundary behavior
- pending user input model
- context window meter
- parser/editor tests

Use `composerDraftStore.ts` as concepts only:

- versioned persisted shape
- cleanup behavior
- model/runtime/mode persistence patterns
- object URL or persisted image cleanup concepts

Avoid for now:

```txt
full Lexical editor copy
full 3,500-line draft store copy
provider model details that do not match Electron/Codex
```

Reason:

T3Code earns Lexical through a lot of parser, cursor, draft, and test infrastructure. We should not adopt Lexical until the lower seams exist.

---

## OpenCode Reference

Important local files:

```txt
packages/app/src/context/prompt.tsx
packages/app/src/components/prompt-input.tsx
packages/app/src/components/prompt-input/attachments.ts
packages/app/src/components/prompt-input/image-attachments.tsx
packages/app/src/components/prompt-input/context-items.tsx
packages/app/src/components/prompt-input/slash-popover.tsx
packages/app/src/components/prompt-input/history.ts
packages/app/src/components/prompt-input/build-request-parts.ts
packages/app/src/components/prompt-input/submit.ts
packages/app/src/pages/session/composer/session-composer-state.ts
packages/app/src/pages/session/composer/session-composer-region.tsx
packages/app/src/pages/session/composer/session-permission-dock.tsx
packages/app/src/pages/session/composer/session-question-dock.tsx
packages/core/src/permission.ts
packages/core/src/config/agent.ts
packages/core/src/session/input.ts
packages/core/src/session/prompt.ts
```

Important tests:

```txt
packages/app/src/components/prompt-input/build-request-parts.test.ts
packages/app/src/components/prompt-input/submit.test.ts
packages/app/src/components/prompt-input/attachments.test.ts
packages/app/src/components/prompt-input/history.test.ts
packages/app/src/pages/session/composer/session-composer-state.test.ts
packages/core/src/permission.test.ts
packages/core/src/session/prompt.test.ts
```

Copy/adapt first:

```txt
packages/app/src/context/prompt.tsx
packages/app/src/components/prompt-input/build-request-parts.ts
packages/app/src/components/prompt-input/submit.ts
packages/app/src/components/prompt-input/attachments.ts
packages/app/src/pages/session/composer/session-composer-state.ts
packages/app/src/pages/session/composer/session-permission-dock.tsx
packages/core/src/session/input.ts
packages/core/src/session/prompt.ts
```

Use for:

- structured prompt part model
- deterministic request part building
- optimistic send and rollback concepts
- separate shell branch
- queue/admission seam
- pending permission/question state
- admitted input lifecycle concepts

Use permission/config as inspiration:

```txt
packages/core/src/permission.ts
packages/core/src/config/agent.ts
```

Do not copy a full permission engine first. Start with smaller composer mode/safety policies.

Avoid:

```txt
SolidJS component structure
2,200-line prompt input shape
implicit auto-accept without explicit risk UI
```

Reason:

OpenCode has the clearest send/admission separation, but its component/runtime architecture should not be ported directly into React/Electron.

---

## Copy Order

Recommended sequence:

```txt
1. OpenCode submit/build-request-parts concepts for thin send admission.
2. Current app payload/provider tests to lock behavior.
3. AionUI/T3Code parser ideas for escaped/quoted mentions.
4. AionUI context meter pattern + T3Code budget semantics.
5. AionUI queue limits + OpenCode queue/admission seam.
6. T3Code Lexical ideas only after P0-P2 are stable.
```

---

## Reference-To-Target Mapping

```txt
AionUI atFileQuery
  -> composerMentionParser.ts

T3Code composerTrigger / composerInlineTokens
  -> composerMentionParser.ts, future inline tokens

OpenCode build-request-parts
  -> composerRequestParts.ts

OpenCode submit
  -> composerSendController.ts

AionUI useConversationCommandQueue
  -> composerQueueStore.ts

T3Code pendingUserInput + OpenCode session composer state
  -> typed pending request domain

AionUI ContextUsageIndicator + T3Code ContextWindowMeter
  -> composerBudget.ts + ComposerContextBudget.tsx

OpenCode permission/session prompt concepts
  -> composerModePolicy.ts + future permission policy
```

---

## Warnings

Do not copy giant components.

Do not introduce Lexical before the parser/draft/send tests exist.

Do not let `ComposerDraftStore` become a catch-all state container.

Do not keep send admission split between `SessionComposer.tsx` and `useCodexSession.ts` longer than necessary.

Do not trust renderer-only file-safety decisions.

Do not silently escalate runtime mode from build to full-access.
