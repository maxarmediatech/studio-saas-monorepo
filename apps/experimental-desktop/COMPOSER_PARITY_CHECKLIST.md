# Composer Parity Checklist

Corrected after local inspection of all four codebases.

```txt
Current app: /Users/rakesh/Developer/agency/studio-saas-monorepo/apps/experimental-desktop
AionUI:     /Users/rakesh/Developer/AionUi
T3Code:     /Users/rakesh/Developer/t3code
OpenCode:   /Users/rakesh/Developer/opencode
```

> The earlier checklist was weaker because T3Code and OpenCode were only skimmed from public repo shape. This version is based on local inspection of both repos.

Legend:

- `[x]` exists in our composer
- `[~]` exists partially or weakly
- `[ ]` missing / should copy-adapt

---

## 1. Our current composer

Primary files:

```txt
src/renderer/components/composer/SessionComposer.tsx
src/renderer/components/composer/ComposerTextarea.tsx
src/renderer/components/composer/ComposerToolbar.tsx
src/renderer/components/composer/ComposerMenu.tsx
src/renderer/components/composer/ComposerContextChips.tsx
src/renderer/components/composer/ComposerAttachmentStrip.tsx
src/renderer/components/composer/PendingRequestDock.tsx
src/renderer/components/composer/composerPayload.ts
src/renderer/components/composer/composerProviderInput.ts
src/renderer/components/composer/composerTriggers.ts
src/renderer/components/composer/useComposerAttachments.ts
src/renderer/components/composer/useComposerContextItems.ts
src/renderer/components/composer/useWorkspaceFileMentions.ts
src/shared/composerAttachmentPolicy.ts
src/main/ipc-attachments.ts
src/main/composer-folder-context.ts
src/main/sidecar-codex-input.ts
```

### Exists now

- [x] Plain textarea composer.
- [x] Toolbar with mode/model/runtime controls.
- [x] Composer modes: `ask`, `plan`, `build`, `review`, `shell`.
- [x] Slash trigger `/`.
- [x] File/workspace trigger `@`.
- [x] Skill trigger `$`.
- [x] Terminal trigger `>`.
- [x] Context chips.
- [x] Workspace file mention search.
- [x] Local file/image attachments.
- [x] Drag/drop and paste attachment handling.
- [x] Native file picker.
- [x] Folder context modes: `reference`, `tree`, `pattern`, `changed-files`, `summary`.
- [x] Folder scan caps and ignored directories.
- [x] Attachment count, file-size, and total-size policy.
- [x] Renderer, main-process, and provider-input attachment validation.
- [x] Codex native input conversion.
- [x] Pending request dock.
- [x] Composer history.
- [x] Structured `ComposerPayload` and `parts` model.

### Partial / weak

- [~] Modes are mostly prompt prefixes, not hard runtime policies.
- [~] `ask`, `plan`, and `review` do not force read-only behavior.
- [~] `shell` is a prompt/request mode, not a distinct shell submit path.
- [~] Mentions are text tokens plus side arrays, not first-class editor entities.
- [~] Mention parser is fragile for paths with spaces, punctuation, and duplicates.
- [~] Context budget is estimated but not enforced or surfaced enough.
- [~] `SessionComposer.tsx` still owns too much orchestration.
- [~] Provider path is Codex-shaped after payload building.
- [~] No persisted per-session composer draft.

### Missing

- [ ] Rich editor or first-class inline entity model.
- [ ] Mention chips inside editor.
- [ ] Escaped/quoted file mention parser.
- [ ] Per-session draft store.
- [ ] Command/follow-up queue.
- [ ] Provider capability adapter.
- [ ] Mode-to-runtime policy layer.
- [ ] Sensitive local-file guardrails.
- [ ] Context usage meter.
- [ ] Context hard budget.
- [ ] Preview/DOM annotation context.
- [ ] Review-comment context.
- [ ] Terminal inline context placeholders.
- [ ] Agent/subagent `@agent` references.
- [ ] Grouped command/search menu.
- [ ] Pure composer reducer/state machine.
- [ ] Parser/editor/queue/draft tests.

---

## 2. AionUI local reference

Important files inspected:

```txt
packages/desktop/src/renderer/components/chat/SendBox/index.tsx
packages/desktop/src/renderer/components/chat/AtFileMenu/index.tsx
packages/desktop/src/renderer/components/chat/SlashCommandMenu.tsx
packages/desktop/src/renderer/hooks/chat/useSendBoxDraft.ts
packages/desktop/src/renderer/hooks/chat/useCompositionInput.ts
packages/desktop/src/renderer/hooks/chat/useSlashCommandController.ts
packages/desktop/src/renderer/hooks/chat/useSlashCommands.ts
packages/desktop/src/renderer/utils/chat/atFileQuery.ts
packages/desktop/src/renderer/pages/conversation/platforms/acp/AcpSendBox.tsx
packages/desktop/src/renderer/pages/conversation/platforms/aionrs/AionrsSendBox.tsx
packages/desktop/src/renderer/pages/conversation/platforms/useConversationCommandQueue.ts
packages/desktop/src/renderer/components/agent/AgentModeSelector.tsx
packages/desktop/src/renderer/utils/model/agentModes.ts
packages/desktop/src/renderer/components/agent/ContextUsageIndicator.tsx
packages/desktop/src/renderer/hooks/file/useUploadState.ts
packages/desktop/src/renderer/hooks/file/usePasteService.ts
packages/desktop/src/renderer/hooks/file/useDragUpload.ts
```

### What exists in AionUI

- [x] Generic `SendBox` used by platform wrappers.
- [x] ACP/AionRS send wrappers.
- [x] Textarea with synchronized highlight overlay.
- [x] `@file` menu.
- [x] Slash command menu.
- [x] Dynamic slash command loading and caching.
- [x] Per-conversation draft store for multiple conversation types.
- [x] Upload progress, cancellation, and abort on conversation switch.
- [x] Mobile action sheet.
- [x] Speech input.
- [x] Preview panel text/DOM snippet insertion.
- [x] Reply quote support.
- [x] Side-question overlay.
- [x] Runtime-backed agent mode selector.
- [x] Backend mode map, including OpenCode build/plan and Codex read-only/default/full-access.
- [x] Context usage indicator.
- [x] Conversation command queue with validation limits.
- [x] Permission cards for runtime requests.
- [x] Tests for at-file parsing, queue behavior, SendBox, and mode selector.

### Copy/adapt from AionUI

- [ ] `utils/chat/atFileQuery.ts` → escaped path mention parser.
- [ ] `SendBox/index.tsx` overlay idea → `ComposerHighlightLayer.tsx`.
- [ ] `useSendBoxDraft.ts` → simple per-session draft hook.
- [ ] `useConversationCommandQueue.ts` → queue validation and runtime gate.
- [ ] `CommandQueuePanel.tsx` → queue UI if present/needed.
- [ ] `useSlashCommands.ts` → dynamic command cache.
- [ ] `useSlashCommandController.ts` → menu keyboard controller.
- [ ] `AgentModeSelector.tsx` + `agentModes.ts` → provider mode mapping.
- [ ] `ContextUsageIndicator.tsx` → context meter UI.
- [ ] `useCompositionInput.ts` → IME-safe Enter handling.
- [ ] Mobile action sheet pattern.

### Do not copy blindly from AionUI

- [ ] Do not copy the giant `SendBox` structure.
- [ ] Do not copy its currently broad client-side file acceptance model.
- [ ] Do not replace our structured payload with string-marker context formatting.
- [ ] Avoid emitter-heavy ownership where direct state/controller APIs work.

---

## 3. T3Code local reference

Important files inspected:

```txt
apps/web/src/components/chat/ChatComposer.tsx                         # 2587 lines
apps/web/src/components/ComposerPromptEditor.tsx                      # 1697 lines
apps/web/src/composer-logic.ts                                        # 280 lines
apps/web/src/composer-editor-mentions.ts                              # 223 lines
apps/web/src/composerDraftStore.ts                                    # 3563 lines
apps/web/src/pendingUserInput.ts                                      # 172 lines
apps/web/src/components/chat/ComposerCommandMenu.tsx
apps/web/src/components/chat/ComposerPrimaryActions.tsx
apps/web/src/components/chat/ComposerPendingApprovalPanel.tsx
apps/web/src/components/chat/ComposerPendingUserInputPanel.tsx
apps/web/src/components/chat/ComposerPendingTerminalContexts.tsx
apps/web/src/components/chat/ComposerPendingElementContexts.tsx
apps/web/src/components/chat/ComposerPreviewAnnotationCards.tsx
apps/web/src/components/chat/ComposerPendingReviewComments.tsx
apps/web/src/components/chat/ContextWindowMeter.tsx
apps/web/src/components/chat/composerProviderState.tsx
packages/shared/src/composerTrigger.ts
packages/shared/src/composerInlineTokens.ts
packages/client-runtime/src/state/composerPathSearch.ts
```

Important tests found:

```txt
apps/web/src/composer-logic.test.ts
apps/web/src/composer-editor-mentions.test.ts
apps/web/src/composerDraftStore.test.ts
apps/web/src/pendingUserInput.test.ts
apps/web/src/components/chat/composerSlashCommandSearch.test.ts
apps/web/src/components/chat/composerProviderState.test.tsx
apps/web/src/components/chat/ComposerPrimaryActions.test.ts
apps/web/src/components/chat/ComposerPendingTerminalContexts.test.tsx
apps/web/src/components/chat/ComposerPreviewAnnotationCards.test.tsx
apps/web/src/components/chat/composerMenuHighlight.test.ts
packages/shared/src/composerTrigger.test.ts
packages/shared/src/composerInlineTokens.test.ts
```

### What exists in T3Code

- [x] Real `ChatComposer` controller.
- [x] Lexical-based `ComposerPromptEditor`.
- [x] Custom Lexical nodes for file mentions, skills, and terminal contexts.
- [x] Inline token segmentation.
- [x] Cursor mapping between collapsed display and expanded source text.
- [x] Selection normalization around inline tokens.
- [x] Backspace and arrow-key behavior around inline tokens.
- [x] Surround-selection behavior that avoids corrupting mention boundaries.
- [x] Shared trigger parser.
- [x] Shared inline token collector.
- [x] Quoted file mention paths.
- [x] Markdown file-link token support.
- [x] Skill token support.
- [x] Provider and built-in slash command groups.
- [x] Provider-specific composer state.
- [x] Model selection stored in composer draft.
- [x] Runtime mode stored in composer draft.
- [x] Interaction mode stored in composer draft: `plan` / `default`.
- [x] Terminal contexts with inline placeholders.
- [x] Element contexts.
- [x] Preview annotations.
- [x] Review comments.
- [x] Image attachments and persisted attachments.
- [x] Draft-thread promotion lifecycle.
- [x] Sticky model selection.
- [x] Context window meter.
- [x] Pending approval panel.
- [x] Multi-question pending user input panel.
- [x] Plan follow-up UX: implement/refine plan.
- [x] Strong test coverage around composer primitives.

### Copy/adapt from T3Code

- [ ] `ComposerPromptEditor.tsx` → Lexical entity editor reference.
- [ ] Custom inline nodes → file mention, skill, terminal context.
- [ ] `composer-logic.ts` → cursor mapping and trigger core.
- [ ] `composer-editor-mentions.ts` → token segmentation and mention-boundary safety.
- [ ] `packages/shared/src/composerTrigger.ts` → quoted path serialization and trigger parser.
- [ ] `packages/shared/src/composerInlineTokens.ts` → mention/skill/file-link token collection.
- [ ] `composerDraftStore.ts` → durable draft architecture, versioning, migrations.
- [ ] Draft cleanup semantics, including image/object URL cleanup.
- [ ] `composerProviderState.tsx` → provider-aware composer state.
- [ ] `ComposerCommandMenu.tsx` → grouped command menu.
- [ ] `ContextWindowMeter.tsx` → context window UI.
- [ ] `pendingUserInput.ts` → multi-question pending input logic.
- [ ] `ComposerPrimaryActions.tsx` → plan follow-up actions.
- [ ] Test categories from T3Code composer tests.

### Do not copy blindly from T3Code

- [ ] Do not copy the whole 3,500-line draft store unless we need all context types.
- [ ] Do not introduce Lexical until we are ready to own editor complexity.
- [ ] Do not copy provider model details exactly; adapt to our Codex/Electron-sidecar architecture.

---

## 4. OpenCode local reference

Important files inspected:

```txt
packages/app/src/components/prompt-input.tsx                          # 2248 lines
packages/app/src/components/prompt-input/submit.ts                    # 599 lines
packages/app/src/components/prompt-input/build-request-parts.ts       # 201 lines
packages/app/src/components/prompt-input/attachments.ts
packages/app/src/components/prompt-input/image-attachments.tsx
packages/app/src/components/prompt-input/context-items.tsx
packages/app/src/components/prompt-input/slash-popover.tsx
packages/app/src/components/prompt-input/history.ts
packages/app/src/context/prompt.tsx
packages/app/src/context/permission.tsx
packages/app/src/pages/session/composer/session-composer-state.ts
packages/app/src/pages/session/composer/session-composer-region.tsx
packages/app/src/pages/session/composer/session-permission-dock.tsx
packages/app/src/pages/session/composer/session-question-dock.tsx
packages/app/src/pages/session/composer/session-followup-dock.tsx
packages/app/src/pages/session/composer/session-revert-dock.tsx
packages/app/src/pages/session/composer/session-todo-dock.tsx
packages/core/src/config/agent.ts
packages/core/src/permission.ts
packages/core/src/permission/schema.ts
packages/core/src/session/input.ts
packages/core/src/session/prompt.ts
```

Important tests found:

```txt
packages/app/src/components/prompt-input/attachments.test.ts
packages/app/src/components/prompt-input/build-request-parts.test.ts
packages/app/src/components/prompt-input/editor-dom.test.ts
packages/app/src/components/prompt-input/history.test.ts
packages/app/src/components/prompt-input/placeholder.test.ts
packages/app/src/components/prompt-input/submit.test.ts
packages/app/src/pages/session/composer/session-composer-state.test.ts
packages/tui/test/prompt/part.test.ts
packages/tui/test/prompt/history.test.ts
packages/tui/test/prompt/persistence.test.ts
packages/tui/test/prompt/local-attachment.test.ts
packages/core/test/permission.test.ts
packages/core/test/agent.test.ts
packages/core/test/session-prompt.test.ts
```

### What exists in OpenCode

- [x] Contenteditable prompt input.
- [x] Structured `Prompt` parts model: text, file, agent, image.
- [x] First-class file pills in editor.
- [x] First-class agent pills in editor.
- [x] Image attachments as prompt parts.
- [x] Context item store separate from inline prompt parts.
- [x] Persisted prompt state scoped by session/draft/workspace.
- [x] Prompt cache limited by session count.
- [x] `@` popover containing agents, recent files, searched files/directories.
- [x] Slash popover with custom and built-in commands.
- [x] Shell mode toggled by `!` at cursor start.
- [x] Separate shell and normal history buckets.
- [x] IME handling around Enter.
- [x] Shift+Enter newline behavior before IME check.
- [x] Keyboard handling for popover navigation.
- [x] Escape exits popover/shell/working state.
- [x] File/image paste handling.
- [x] Drag/drop handling for images and file references.
- [x] New-session worktree creation/selection before send.
- [x] Follow-up queue through `shouldQueue` / `onQueue`.
- [x] Optimistic user message insertion.
- [x] Rollback on failed send.
- [x] Worktree preparation wait with abort and timeout.
- [x] Request part builder for text/files/agents/images/context.
- [x] File selection range encoded in file URL query.
- [x] Comment context creates synthetic text plus file parts.
- [x] `@agent` references become agent request parts.
- [x] Permission system with allow / ask / deny rule evaluation.
- [x] Permission dock with reject / allow once / allow always.
- [x] Auto-accept state with directory/session scoping.
- [x] Agent config supports primary/subagent/all style modes.
- [x] Agent config includes permission rules.
- [x] Session composer blocks normal input on permission/question requests.
- [x] Session docks: permission, question, follow-up, revert, todo.

### Copy/adapt from OpenCode

- [ ] `context/prompt.tsx` → structured prompt part model and scoped persistence.
- [ ] `prompt-input.tsx` → contenteditable file/agent pill model.
- [ ] `@agent` support.
- [ ] `prompt-input/build-request-parts.ts` → deterministic request part builder.
- [ ] `prompt-input/submit.ts` → optimistic send, rollback, queue seam, shell branch.
- [ ] `prompt-input/attachments.ts` → paste/drop/image handling ideas.
- [ ] Separate shell vs normal history.
- [ ] New-session/worktree preparation flow if we support worktrees.
- [ ] `session-composer-state.ts` → pending permission/question/todo dock state.
- [ ] `session-composer-region.tsx` → composer dock composition and follow-up queue seam.
- [ ] `session-permission-dock.tsx` → reject / allow once / allow always UX.
- [ ] `core/src/permission.ts` → allow/ask/deny rule engine.
- [ ] `core/src/config/agent.ts` → agent permission and subagent mode config.
- [ ] Test categories from prompt-input and permission tests.

### Do not copy blindly from OpenCode

- [ ] Do not copy the full 2,200-line `prompt-input.tsx` shape.
- [ ] Do not copy SolidJS patterns directly into React.
- [ ] Do not make shell mode look safer than it is; direct shell behavior must be permission-gated.
- [ ] Do not copy auto-accept without explicit user-facing risk controls.

---

## 5. Cross-repo parity matrix

| Area | Our composer | AionUI | T3Code | OpenCode | Action |
|---|---:|---:|---:|---:|---|
| Textarea input | [x] | [x] | [ ] | [ ] | Keep only short-term |
| Rich editor | [ ] | [ ] | [x] Lexical | [x] contenteditable | Choose long-term editor path |
| Inline file chips | [ ] | [~] | [x] | [x] | Needed |
| Inline skill chips | [ ] | [ ] | [x] | [ ] | Useful |
| Inline terminal context | [ ] | [ ] | [x] | [ ] | Useful |
| Agent/subagent mention | [ ] | [ ] | [ ] | [x] | Copy OpenCode concept |
| Slash commands | [x] static | [x] dynamic | [x] grouped | [x] custom+builtin | Make provider-aware |
| Mention parser with spaces | [ ] | [x] escaped | [x] quoted | [~] via pills | Copy Aion/T3 |
| Structured prompt parts | [~] payload only | [~] mixed | [x] draft store | [x] prompt parts | Needed |
| Per-session drafts | [ ] | [x] | [x] | [x] | Needed |
| Draft migrations | [ ] | [~] | [x] | [x] | Copy T3Code |
| Image attachments | [x] | [x] | [x] | [x] | Keep/harden |
| Local file validation | [x] strong | [~] broad | [~] not main finding | [~] not main finding | Keep ours |
| File-safety warnings | [ ] | [ ] | [ ] | [ ] | Add ourselves |
| Folder context modes | [x] strong | [~] | [~] | [~] | Keep ours |
| Context usage meter | [ ] | [x] | [x] | [ ] | Copy Aion/T3 |
| Pending approvals | [x] dock | [x] cards | [x] panels | [x] dock | Improve |
| Pending user input | [~] basic | [~] | [x] multi-question | [x] question dock | Copy T3/OpenCode |
| Command/follow-up queue | [ ] | [x] | [ ] not obvious | [x] | Copy Aion/OpenCode |
| Shell as direct action | [~] prompt prefix | [~] request | [ ] | [x] session shell | Make distinct + gated |
| Separate shell history | [ ] | [ ] | [ ] | [x] | Copy OpenCode |
| Runtime policy | [~] runtime selector | [x] config modes | [x] runtime + interaction | [x] permission rules | Needed |
| Plan/build semantics | [~] prompt prefix | [x] modes | [x] plan follow-up | [x] agent/permission model | Needed |
| Optimistic send/rollback | [ ] | [~] | [~] | [x] | Copy OpenCode |
| Worktree-aware send | [ ] | [ ] | [x] | [x] | Optional |
| Tests | [ ] weak | [x] | [x] extensive | [x] extensive | Add tests |

---

## 6. Recommended roadmap

### Phase 1 — Mode and permission guardrails

- [ ] Add `composerModePolicy.ts`.
- [ ] `ask`, `plan`, and `review` must enforce read-only behavior.
- [ ] `build` should map to workspace-write/default behavior.
- [ ] `shell` should become a distinct shell action where supported.
- [ ] Full-access mode requires visible escalation warning.
- [ ] Add mode policy tests.

Copy concepts from:

```txt
AionUI:   agentModes.ts, AgentModeSelector.tsx
T3Code:   runtimeMode + interactionMode draft state
OpenCode: permission rule engine, agent config
```

### Phase 2 — Provider capability adapter

- [ ] Add `composerCapabilities.ts`.
- [ ] Add `ProviderComposerAdapter`.
- [ ] Move current Codex-specific input building into `adapters/codexComposerAdapter.ts`.
- [ ] Model local files, images, folders, shell action, slash commands, runtime modes, pending permissions, attachment limits, and context budget as capabilities.

### Phase 3 — Draft store

- [ ] Add `composerDraftStore.ts`.
- [ ] Store prompt parts/text, mode, runtime mode, model/provider, context items, attachments/images, and future context types.
- [ ] Add storage version and migrations.
- [ ] Remove empty drafts.
- [ ] Clean up temporary object URLs on removed images.
- [ ] Add tests.

### Phase 4 — Mention/entity model

Recommended order:

```txt
Short term: AionUI overlay + T3Code quoted parser
Long term: choose T3Code Lexical or OpenCode contenteditable model
```

- [ ] Add escaped/quoted mention parser.
- [ ] Add highlight overlay.
- [ ] Later, replace textarea with either Lexical nodes or contenteditable pills.

### Phase 5 — Command/follow-up queue

- [ ] Add `composerQueue.ts`.
- [ ] Add `ComposerQueuePanel.tsx`.
- [ ] Queue when runtime is busy.
- [ ] Allow edit/remove/reorder/clear.
- [ ] Execute only when runtime gate is ready.
- [ ] Add tests.

### Phase 6 — Request part builder

- [ ] Add `composerRequestParts.ts` or fold into provider adapters.
- [ ] Convert structured draft to request parts: user text, files, folder context, images, agents, terminal context, synthetic notes.
- [ ] Dedupe file/context parts.
- [ ] Preserve file selections/ranges where supported.
- [ ] Add tests.

### Phase 7 — Pending approvals and user input

- [ ] Split pending requests by type.
- [ ] Add typed pending approval model.
- [ ] Add typed pending user input model.
- [ ] Add multi-question pending input support.
- [ ] Add progress state.
- [ ] Add keyboard shortcuts for option selection.
- [ ] Add approval choices where runtime supports them.
- [ ] Add tests.

### Phase 8 — File-safety and context budget

- [ ] Add `composerSensitiveFiles.ts`.
- [ ] Warn/block high-risk local project files before sending them.
- [ ] Add explicit override flow.
- [ ] Add `composerBudget.ts`.
- [ ] Warn at high context usage.
- [ ] Block or require confirmation at hard limit.
- [ ] Add tests.

---

## 7. Target architecture

```txt
src/renderer/components/composer/
  SessionComposer.tsx
  ComposerView.tsx
  ComposerTextarea.tsx
  ComposerHighlightLayer.tsx
  ComposerRichEditor.tsx
  ComposerToolbar.tsx
  ComposerMenu.tsx
  ComposerContextChips.tsx
  ComposerAttachmentStrip.tsx
  ComposerQueuePanel.tsx
  PendingRequestDock.tsx

  core/
    composerState.ts
    composerActions.ts
    composerReducer.ts
    composerParser.ts
    composerMentionParser.ts
    composerInlineTokens.ts
    composerCommands.ts
    composerCommandRegistry.ts
    composerModePolicy.ts
    composerCapabilities.ts
    composerDraftStore.ts
    composerQueue.ts
    composerSensitiveFiles.ts
    composerBudget.ts
    composerKeybindings.ts
    composerRequestParts.ts
    __tests__/
      composerParser.test.ts
      composerMentionParser.test.ts
      composerInlineTokens.test.ts
      composerModePolicy.test.ts
      composerDraftStore.test.ts
      composerQueue.test.ts
      composerRequestParts.test.ts
      composerPayload.test.ts

  adapters/
    codexComposerAdapter.ts
    opencodeComposerAdapter.ts
    claudeComposerAdapter.ts
    cursorComposerAdapter.ts
```

---

## 8. Highest priority checklist

- [ ] Real mode guardrails: `ask/plan/review` must enforce read-only behavior.
- [ ] Provider capability adapter.
- [ ] Per-session draft store.
- [ ] Escaped/quoted mention parser.
- [ ] Highlight layer or rich editor.
- [ ] Request part builder tests.
- [ ] File-safety policy.
- [ ] Context usage meter.
- [ ] Command/follow-up queue.
- [ ] Pending user input improvements.

Recommended copy order:

```txt
1. AionUI atFileQuery + highlight overlay
2. T3Code draft-store concepts + inline token tests
3. OpenCode request-parts + optimistic send/rollback
4. AionUI/OpenCode queue flow
5. T3Code Lexical editor only after policy/draft/adapter layer is stable
```
