# Composer Parity Reviewed

Reviewed against actual local code on 2026-06-23.

```txt
Our app:  /Users/rakesh/Developer/agency/studio-saas-monorepo/apps/experimental-desktop
AionUI:   /Users/rakesh/Developer/AionUi
T3Code:   /Users/rakesh/Developer/t3code
OpenCode: /Users/rakesh/Developer/opencode
```

This is a reviewed planning document, not a copy of `COMPOSER_PARITY_CHECKLIST.md`. The original file is intentionally untouched.

## Executive Read

The app is not failing because image support is fundamentally impossible. It is failing because the composer still has too many state owners and too few domain seams.

The current implementation already has good raw pieces:

- structured `ComposerPayload.parts`
- renderer/main/provider attachment validation
- native Codex image/file handoff
- folder context modes with caps
- pending request dock

The weak point is the composer architecture around those pieces:

- `App.tsx` owns message, context, attachments, draft persistence, model, runtime mode.
- `SessionComposer.tsx` owns menu state, history, send orchestration, context hooks, attachment hooks, pending input drafts.
- `useComposerAttachments.ts` and `useComposerContextItems.ts` own local state while also reporting back to parent state.
- Draft persistence happens from `App.tsx`, not from a dedicated composer draft store.

That shape makes feedback loops and race conditions likely. The image bug was a symptom of that architecture.

## What I Actually Checked

Our app:

```txt
src/renderer/components/composer/SessionComposer.tsx
src/renderer/components/composer/composerPayload.ts
src/renderer/components/composer/composerProviderInput.ts
src/renderer/components/composer/useComposerAttachments.ts
src/renderer/components/composer/useComposerContextItems.ts
src/renderer/components/composer/useComposerFileDrop.ts
src/renderer/components/composer/useComposerHistory.ts
src/renderer/components/composer/composerTriggers.ts
src/renderer/components/composer/useWorkspaceFileMentions.ts
src/renderer/app/App.tsx
src/main/sidecar-codex-input.ts
src/main/composer-image-normalizer.ts
src/main/ipc-attachments.ts
src/shared/composerAttachmentPolicy.ts
```

AionUI:

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

T3Code:

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
```

OpenCode:

```txt
packages/app/src/context/prompt.tsx
packages/app/src/components/prompt-input.tsx
packages/app/src/components/prompt-input/attachments.ts
packages/app/src/components/prompt-input/build-request-parts.ts
packages/app/src/components/prompt-input/submit.ts
packages/app/src/pages/session/composer/session-composer-state.ts
packages/app/src/pages/session/composer/session-composer-region.tsx
packages/app/src/pages/session/composer/session-permission-dock.tsx
packages/core/src/permission.ts
packages/core/src/config/agent.ts
packages/core/src/session/input.ts
packages/core/src/session/prompt.ts
```

## Current App Assessment

### Strong Pieces

- Attachment policy is stricter than AionUI and good to keep.
- Image handoff is real: renderer builds `local_image`, main validates it, then Codex receives `localImage`.
- Folder context is stronger than the references for local project scanning.
- `ComposerPayload.parts` is the right direction.
- The recent feedback-loop fix moves reset behavior toward explicit `resetSignal` semantics.

### Weak Pieces

- Modes are prompt prefixes, not policy. `ask`, `plan`, and `review` can still run with edit-capable runtime mode.
- `shell` is presented like a mode, but sends through the normal prompt flow.
- Composer state is not centralized. Text, context, attachments, history, draft persistence, and provider input are split across multiple owners.
- Draft persistence is debounce-driven from `App.tsx`, so it observes composer state from outside rather than owning the draft.
- Mentions are text plus side arrays, not durable inline entities.
- Context budget is estimated but not enforced.
- No tests exist under `apps/experimental-desktop` for composer parser, attachments, provider input, draft behavior, or mode policy.

## Reference Findings

### AionUI

What they do right:

- `atFileQuery.ts` has escaped path parsing and insertion. This solves spaces, punctuation, and special path chars.
- `useUploadState.ts` uses a module store plus `useSyncExternalStore`, giving stable snapshots and upload lifecycle ownership.
- `useConversationCommandQueue.ts` has concrete queue limits, persistence, normalization, validation, and runtime gate behavior.
- `agentModes.ts` maps modes by backend and merges dynamic capability modes.
- `ContextUsageIndicator.tsx` gives a clear 70% warning / 90% danger pattern.

What not to copy:

- `SendBox/index.tsx` is 1,653 lines. It mixes UI, paste, preview, mentions, upload, history, slash commands, speech, and sending. We should copy utilities and concepts, not the component shape.
- Its file acceptance model is broader than ours. Keep our policy.

Best AionUI imports for us:

```txt
atFileQuery.ts
useConversationCommandQueue.ts
useUploadState.ts
agentModes.ts
ContextUsageIndicator.tsx
useCompositionInput.ts
```

### T3Code

What they do right:

- `ComposerPromptEditor.tsx` uses Lexical with first-class file, skill, and terminal-context nodes.
- `composer-logic.ts` handles cursor mapping between collapsed display and expanded source text.
- `composer-editor-mentions.ts` protects mention boundaries and splits prompt text into durable segments.
- `packages/shared/src/composerTrigger.ts` serializes quoted file paths and detects triggers.
- `packages/shared/src/composerInlineTokens.ts` handles mentions, skills, and markdown file links.
- `composerDraftStore.ts` owns prompt, images, runtime mode, interaction mode, provider/model state, terminal contexts, preview annotations, review comments, persisted attachments, and cleanup.
- Tests cover the actual scary parts: trigger parsing, inline tokens, draft store, pending user input, menu search, provider state, primary actions, terminal contexts, preview annotations.

What not to copy yet:

- Do not start with Lexical. It only works because T3Code has parser, draft, cursor, selection, and tests around it.
- Do not copy the 3,563-line draft store as-is. We need a smaller store shaped to Electron/Codex first.

Best T3Code imports for us:

```txt
packages/shared/src/composerTrigger.ts
packages/shared/src/composerInlineTokens.ts
apps/web/src/composer-logic.ts
apps/web/src/composer-editor-mentions.ts
apps/web/src/composerDraftStore.ts concepts only
apps/web/src/components/chat/ContextWindowMeter.tsx
```

### OpenCode

What they do right:

- `context/prompt.tsx` defines prompt parts as the composer source of truth: text, file, agent, image.
- Prompt state is scoped and persisted by draft/session/workspace with an explicit cache limit.
- `build-request-parts.ts` is a deterministic translator from prompt/context/images to request parts and optimistic parts.
- `submit.ts` handles send orchestration separately: queue, shell branch, new-session/worktree prep, optimistic message insertion, rollback, and abort.
- `attachments.ts` keeps paste/drop/image handling separate from request building.
- `permission.ts` provides allow/ask/deny rule evaluation and pending permission lifecycle.
- `session-composer-state.ts` derives blocked state from permission/question requests.

What not to copy:

- Do not port SolidJS component patterns into React.
- Do not copy the 2,248-line prompt input shape.
- Do not copy auto-accept without explicit risk UI.

Best OpenCode imports for us:

```txt
context/prompt.tsx part model
prompt-input/build-request-parts.ts
prompt-input/submit.ts send orchestration concepts
prompt-input/attachments.ts
session-composer-state.ts
session-permission-dock.tsx
core/src/permission.ts
core/src/config/agent.ts
```

## What We Are Doing Wrong

### 1. UI State Before Domain State

We have a composer UI, but not yet a composer domain model. The UI drives the state shape.

References invert that:

- OpenCode: prompt parts first, UI renders/edit parts.
- T3Code: draft store and inline tokens first, editor renders them.
- AionUI: draft/queue/upload stores outside the component.

### 2. Modes Are Not Policy

Our modes are currently user-facing intent labels. They do not hard-bind runtime behavior.

Correct model:

```txt
composer mode -> policy -> provider/runtime capability -> request/send behavior
```

Example:

```txt
ask    -> read-only, no edits, no shell
plan   -> read-only, no edits, no shell
review -> read-only, no edits, no shell
build  -> workspace-write unless user escalates
shell  -> direct shell action only if capability + permission allow it
```

### 3. Request Building Is Too Close To UI

`composerProviderInput.ts` is useful, but provider behavior is still Codex-shaped and close to renderer payload state.

References have clearer layers:

```txt
prompt/draft state
-> request part builder
-> provider/session send
-> optimistic UI / rollback / queue
```

### 4. Tests Are Missing Where They Matter

The references test:

- trigger parsing
- inline tokens
- attachments
- request part building
- submit/queue behavior
- prompt persistence
- permission rules

Our desktop composer currently has no equivalent focused tests.

## Recommended Architecture

Do not jump straight to rich editor.

Target layers:

```txt
ComposerDraftStore
  owns text/prompt parts, mode, runtime mode, model, context, attachments, queue

ComposerDomain
  reducer/actions/selectors
  parser and inline-token utilities
  mode policy
  context budget
  sensitive-file policy

ComposerAdapters
  codex adapter first
  later opencode/claude/cursor adapter if needed

ComposerView
  renders text area or future rich editor
  no provider-specific send logic

ComposerSend
  request part builder
  optimistic user message
  rollback
  queue/interrupt handling
```

## Implementation Order

### Phase 0: Lock The Image Fix With Tests

Goal: prevent regression before larger refactor.

- Add tests for `buildComposerPayload`.
- Add tests for `buildComposerProviderInput`.
- Add tests for attachment duplicate/limit/pathless behavior.
- Add a test that parent echo of unchanged attachment/context arrays does not loop or re-report.

Why first: the current bug class needs a tripwire.

### Phase 1: Mode Policy

Add `composerModePolicy.ts`.

Minimum behavior:

```txt
ask/review/plan -> force read-only runtime
build           -> allow workspace-write
shell           -> no attachments/context, direct shell only when supported
full-access     -> explicit escalation warning
```

Tests:

```txt
ask with workspace-write -> read-only
plan with full-access -> read-only
build with read-only -> workspace-write only if user chose build escalation
shell with attachment -> blocked
```

### Phase 2: Composer Draft Store

Move draft ownership out of `App.tsx`.

The store should own:

- text or prompt parts
- mode
- runtime mode
- model
- context items
- attachments
- pending queue
- version

Keep it small. Do not copy T3Code's full store.

### Phase 3: Provider Capability Adapter

Add:

```txt
composerCapabilities.ts
codexComposerAdapter.ts
composerRequestParts.ts
```

Capabilities should include:

- native images
- local file mentions
- shell action
- runtime modes
- slash commands
- pending approvals
- context budget
- max attachments

### Phase 4: Parser + Highlight Layer

Short-term:

- copy-adapt AionUI escaped `@file` parser
- copy-adapt T3Code quoted path serializer
- add a textarea highlight layer

Long-term:

- choose Lexical or contenteditable only after store/policy/adapter/tests exist

### Phase 5: Send Orchestration

Copy concepts from OpenCode:

- deterministic request parts
- optimistic user message insertion
- rollback on send failure
- shell branch separate from normal prompt
- queue branch when turn is active

### Phase 6: Queue

Copy AionUI limits and OpenCode send hook:

```txt
max queued commands: 20
max input length: 20_000
max serialized queue: 256 KB
```

Queue UI should allow edit, remove, reorder, clear, pause, and resume.

### Phase 7: Pending Requests

Split pending requests by type: permission, user input/question, file change, command, and todo/progress.

Do not use one generic dock for all of them long-term.

### Phase 8: Rich Editor

Only after all above:

- T3Code Lexical path if we need complex inline tokens and cursor correctness.
- OpenCode contenteditable path if we prefer simpler DOM ownership and file/agent pills.

My recommendation: start with textarea + highlight layer; defer rich editor.

## Priority Checklist

P0:

- [ ] Add composer primitive tests.
- [ ] Add mode policy layer.
- [ ] Move draft ownership out of `App.tsx`.
- [ ] Add Codex composer adapter boundary.

P1:

- [ ] Add escaped/quoted mention parser.
- [ ] Add request part builder tests.
- [ ] Add context budget meter.
- [ ] Add sensitive-file warning/block.

P2:

- [ ] Add queue.
- [ ] Split pending request docks.
- [ ] Add optimistic user message and rollback.
- [ ] Add separate shell send path.

P3:

- [ ] Add highlight overlay.
- [ ] Evaluate Lexical vs contenteditable.
- [ ] Add first-class file/skill/agent/terminal chips.

## Decision Notes

Keep from our app:

- attachment policy
- folder context modes
- Codex native input conversion
- structured payload direction

Copy first:

```txt
AionUI:   atFileQuery, queue limits, upload store pattern, mode mapping
T3Code:   inline token parser/tests, cursor logic concepts, context meter
OpenCode: prompt parts model, request part builder, submit/rollback structure, permission model
```

Avoid:

```txt
AionUI:   giant SendBox component
T3Code:   Lexical before core tests/state exist
OpenCode: SolidJS component structure, auto-accept without risk controls
```

Final call:

The next serious step is not UI polish. It is a composer domain layer with policy and tests. Once that exists, image attachments, mode behavior, queueing, and rich editor work become predictable instead of fragile.
