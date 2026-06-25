# Conversation Panel Reference Gap Report

Created: 2026-06-24
Scope: source-code review only, no visual runtime smoke.
Target app: `apps/experimental-desktop`
Target surface: conversation panel, timeline/stage, message rows, composer-adjacent conversation behavior, scrolling, and CSS/interaction details.

## Reference folders reviewed

### T3Code

Workspace: `/Users/rakesh/Developer/t3code`

Main files inspected:

- `apps/web/src/components/ChatView.tsx`
- `apps/web/src/components/chat/MessagesTimeline.tsx`
- `apps/web/src/components/chat/MessagesTimeline.logic.ts`
- `apps/web/src/components/chat/ChatComposer.tsx`
- `apps/web/src/components/chat/ComposerBannerStack.tsx`
- `apps/web/src/components/chat/ComposerPendingApprovalPanel.tsx`
- `apps/web/src/components/chat/ComposerPendingUserInputPanel.tsx`
- `apps/web/src/components/chat/ComposerPendingApprovalActions.tsx`
- `apps/web/src/components/chat/MessageCopyButton.tsx`
- `apps/web/src/components/chat/ChatHeader.tsx`
- `apps/web/src/components/chat/ProviderStatusBanner.tsx`
- `apps/web/src/components/chat/ThreadErrorBanner.tsx`
- `apps/web/src/components/composerFooterLayout.ts`

### OpenCode

Workspace: `/Users/rakesh/Developer/oss/opencode`

Main files inspected:

- `packages/app/src/pages/session.tsx`
- `packages/app/src/pages/session/timeline/message-timeline.tsx`
- `packages/app/src/pages/session/timeline/model.ts`
- `packages/app/src/pages/session/timeline/projection.ts`
- `packages/app/src/pages/session/timeline/rows.ts`
- `packages/app/src/pages/session/composer/session-composer-region.tsx`
- `packages/app/src/pages/session/composer/session-permission-dock.tsx`
- `packages/app/src/pages/session/composer/session-question-dock.tsx`
- `packages/app/src/pages/session/composer/session-followup-dock.tsx`
- `packages/app/src/pages/session/composer/session-revert-dock.tsx`
- `packages/app/src/pages/session/composer/session-todo-dock.tsx`
- `packages/app/src/pages/session/use-session-hash-scroll.ts`
- `packages/app/src/context/layout-scroll.ts`
- `packages/ui/src/components/session-turn.css`
- `packages/app/src/index.css`

### AionUI

Workspace: `/Users/rakesh/Developer/AionUI`

Main files inspected:

- `packages/desktop/src/renderer/pages/conversation/components/ChatConversation.tsx`
- `packages/desktop/src/renderer/pages/conversation/components/ChatLayout/chat-layout.css`
- `packages/desktop/src/renderer/pages/conversation/Messages/MessageList.tsx`
- `packages/desktop/src/renderer/pages/conversation/Messages/useAutoScroll.ts`
- `packages/desktop/src/renderer/pages/conversation/Messages/messages.css`
- `packages/desktop/src/renderer/pages/conversation/Messages/MessageFileChanges.tsx`
- `packages/desktop/src/renderer/pages/conversation/Messages/components/MessageText.tsx`
- `packages/desktop/src/renderer/pages/conversation/Messages/components/MessageThinking.tsx`
- `packages/desktop/src/renderer/pages/conversation/Messages/components/MessageToolCall.tsx`
- `packages/desktop/src/renderer/pages/conversation/Messages/components/MessageToolGroup.tsx`
- `packages/desktop/src/renderer/pages/conversation/Messages/components/MessageToolGroupSummary.tsx`
- `packages/desktop/src/renderer/pages/conversation/platforms/acp/AcpSendBox.tsx`
- `packages/desktop/src/renderer/pages/conversation/platforms/useConversationCommandQueue.ts`
- `packages/desktop/src/renderer/components/chat/CommandQueuePanel.tsx`
- `packages/desktop/src/renderer/components/chat/SendBox/sendbox.css`

### Traycer

Workspace: `/Users/rakesh/Developer/Traycer`

Main files inspected:

- `clients/gui-app/src/components/chat/chat-messages.tsx`
- `clients/gui-app/src/components/chat/chat-messages-virtuoso-helpers.ts`
- `clients/gui-app/src/components/chat/chat-message.tsx`
- `clients/gui-app/src/components/chat/chat-message-assistant-body.tsx`
- `clients/gui-app/src/components/chat/chat-message-user-body.tsx`
- `clients/gui-app/src/components/chat/chat-activity-groups.ts`
- `clients/gui-app/src/components/chat/chat-scroll-state-cache.ts`
- `clients/gui-app/src/components/chat/scroll-to-bottom-chip.tsx`
- `clients/gui-app/src/components/chat/chat-user-message-minimap.tsx`
- `clients/gui-app/src/components/chat/chat-user-message-minimap-items.ts`
- `clients/gui-app/src/components/chat/queued-message-surface.tsx`
- `clients/gui-app/src/components/chat/chat-lower-dock.tsx`
- `clients/gui-app/src/components/chat/chat-pinned-stack.tsx`
- `clients/gui-app/src/components/chat/chat-accumulated-changes-panel.tsx`
- `clients/gui-app/src/components/chat/chat-active-agents-panel.tsx`
- `clients/gui-app/src/components/chat/agent-stop-button.tsx`
- `clients/gui-app/src/stores/chats/rendered-messages.ts`
- `clients/gui-app/src/index.css`
- `clients/gui-app/src/lib/layout/panel-resizing-class.ts`

### Our current desktop surface

Workspace: `/Users/rakesh/Developer/agency/studio-saas-monorepo`

Main files inspected:

- `apps/experimental-desktop/src/renderer/app/DesktopCompatibilityView.tsx`
- `apps/experimental-desktop/src/renderer/components/conversation/ConversationStage.tsx`
- `apps/experimental-desktop/src/renderer/components/conversation/ConversationTimeline.tsx`
- `apps/experimental-desktop/src/renderer/components/conversation/TimelineRow.tsx`
- `apps/experimental-desktop/src/renderer/components/conversation/PendingRequestLayer.tsx`
- `apps/experimental-desktop/src/renderer/conversations/conversationTimelineModel.ts`
- `apps/experimental-desktop/src/renderer/conversations/conversationProjection.ts`
- `apps/experimental-desktop/src/renderer/components/composer/ComposerRegion.tsx`
- `apps/experimental-desktop/src/renderer/components/composer/SessionComposer.tsx`
- `apps/experimental-desktop/src/renderer/components/composer/ComposerPrimaryButton.tsx`
- `apps/experimental-desktop/src/renderer/components/ui/scroll-area.tsx`
- `apps/experimental-desktop/src/renderer/styles.css`

## Executive summary

Our current conversation panel is a good first pass for proving route + composer + timeline architecture, but compared to T3Code, OpenCode, AionUI, and Traycer it is still a basic transcript renderer.

The biggest missing areas are:

1. **No robust scroll system.** No initial scroll-to-bottom, no maintain-scroll-at-end, no user-scroll intent tracking, no scroll-to-bottom pill, no resize-observer based follow mode, no history/prepend anchor preservation, no hash/message jump behavior, and no virtualization.
2. **No mature timeline model.** Our rows are only `message`, `request`, and `event`. The references model turns, work logs, tool groups, diff summaries, proposed plans, artifacts, retry cards, thinking rows, compaction rows, file summaries, command queues, and child/parent session state.
3. **No rich message rendering.** Text is `white-space: pre-wrap`; there is no Markdown/code rendering, syntax highlighting, diff rendering, file tree rendering, image preview, image lightbox, copy/retry/revert actions, long-message collapsing, or hover metadata polish.
4. **No serious performance story.** T3Code uses LegendList with row structural sharing. OpenCode uses TanStack virtualizer, cached measurements, overscan management, anchored resizing, and E2E performance tests. Traycer uses Virtuoso Message List, explicit scroll modifiers, cached rendered message models, resize-freezing with `content-visibility`, and minimap-aware active row tracking. Our timeline renders every row directly in a normal scroll area.
5. **Composer/timeline integration is shallow.** References make pending approvals, questions, followups, plan implementation, queue, revert, terminal context, preview annotations, and runtime state visible as first-class UI. Our pending request layer exists but is simple, and our queue panel is local to the composer, not integrated into the timeline or hydrated durably.
6. **CSS and interaction details are missing.** No scroll anchoring controls, no scrollbar-gutter/overscroll containment, no sticky subheaders, no progress bar, no shimmer/skeleton loading, no mobile typography tuning, no stop-button breathing animation, no gradient/floating scroll controls, no hover-only row actions, and limited focus/ARIA polish.

## Our current implementation snapshot

### Current component shape

Our current visible conversation panel is roughly:

```txt
DesktopCompatibilityView
  -> ConversationStage
    -> ConversationTimeline
      -> ScrollArea
        -> rows.map(TimelineRow)
    -> PendingRequestLayer
    -> ComposerRegion
```

Current row types from `conversationTimelineModel.ts`:

```txt
message
request
event
```

Current part types:

```txt
text
file
image
context
tool
approval
raw
```

Current rendering behavior:

- Uses `ScrollArea` from Base UI.
- Renders every row directly with `.map()`.
- Centers content with `max-w-[980px]`.
- User/assistant rows use bubble-like cards with `max-w-[82%]`.
- Assistant and user text are plain `<p>` elements with `whitespace-pre-wrap break-words`.
- Provider/tool/raw parts render as a bordered card with a `<pre>` capped to `max-h-44`.
- Requests render as simple approval cards with `pending/resolved` badge.
- Events render as basic info/error cards.
- Composer sits below timeline with `pt-4`.

This is much simpler than all three references.

## Gap matrix

| Area | T3Code | OpenCode | AionUI | Our current state | Gap severity |
| --- | --- | --- | --- | --- | --- |
| Virtualized timeline | LegendList | TanStack virtualizer | Plain list, but optimized grouping/scroll | Plain map | High |
| Maintain scroll at bottom | `initialScrollAtEnd`, `maintainScrollAtEnd` | `anchorTo: end`, `followOnAppend`, custom anchors | custom `useAutoScroll` | Missing | High |
| Scroll-to-bottom UI | Floating pill with debounce | Floating arrow button with transitions | Floating circular down button | Missing | High |
| User scroll intent | `onIsAtEndChange` + debounced pill | gesture detection + auto-scroll pause | wheel/pointer/programmatic guards | Missing | High |
| Prepend/history anchor | Not main pattern, but list handles position | explicit capture/restore prepend anchor | message jump support | Missing | High |
| Message jump/highlight | Thread route references and row keys | hash scroll to message + reveal | `targetMessageId` + highlight | Missing | Medium-high |
| Markdown rendering | `ChatMarkdown` | `Message` / `MessagePart` UI | markdown-shadow/message text renderer | Plain text | High |
| Code/diff rendering | diff panel and changed-files cards | full diff summary accordion | file summary cards | Missing | High |
| Tool calls | grouped, compacted, foldable | `ContextToolGroup`, tool parts | tool summary grouping | Basic raw `<pre>` | High |
| Thinking/progress | working row + timer | shimmer/reveal + progress bar | thinking message component | Basic status badge only | High |
| Copy actions | user/assistant copy buttons | message actions through UI primitives | copy row per turn | Missing | Medium |
| Revert/retry | revert user message; retry patterns | `SessionRetry`, revert dock | runtime error and send failure surfaces | Missing | High |
| Pending approvals | rich composer panels/actions | permission/question docks | permission components | simple request cards/layer | High |
| Queue UI | queue-like follow-up behavior | followup dock | full queue with persistence/reorder | local queue panel only | High |
| Long message collapse | collapsible user body | part folds/accordion | not central | Missing | Medium |
| Images | image dialog | image/message parts | image preview group | only file/image reference card | High |
| Header/status | rich chat header + banners | sticky session title + context usage | model/runtime/header extras | basic top tabs/settings elsewhere | Medium-high |
| Skeleton/loading | not primary in inspected panel | progress/shimmer | skeleton rows | Missing | Medium |
| Mobile polish | safe-area paddings | responsive centered widths | mobile typography/action sheet | Desktop-first only | Medium |
| CSS interaction polish | hover actions, transitions | data-slot CSS system, sticky headers | sendbox breathing/mobile CSS | minimal | High |

## Detailed gaps by category

## 1. Scroll behavior gaps

### 1.1 No initial scroll-to-bottom

References:

- T3Code uses LegendList with `initialScrollAtEnd`.
- OpenCode uses virtualizer `initialOffset: Number.MAX_SAFE_INTEGER` when bottom anchoring is desired, then calls `scrollToEnd()` on mount frames.
- AionUI runs an initial `requestAnimationFrame` scroll to bottom once items exist.

Our current `ConversationTimeline` simply renders:

```tsx
<ScrollArea className="h-full min-h-0">
  <div>{rows.map(...)}</div>
</ScrollArea>
```

There is no first-load scroll positioning. A restored or newly opened conversation can start at the top depending on Base UI viewport behavior.

Needed:

- Explicit viewport ref.
- Scroll to bottom on first load when the route opens normally.
- Do not force bottom when opening a specific message anchor in the future.

### 1.2 No maintain-scroll-at-end while streaming

References:

- T3Code: `maintainScrollAtEnd={!foldToggleSettling}` and `maintainScrollAtEndThreshold={0.1}`.
- OpenCode: virtualizer uses `anchorTo: "end"`, `followOnAppend: true`, `scrollEndThreshold: 80`, and manual `maybeAnchorBottom()` calls.
- AionUI: `ResizeObserver` observes both scroller and content and schedules auto-follow only when user has not intentionally scrolled away.

Our current panel does not track whether the user is at the bottom. During streaming or async provider event append, the scroll position is not deliberately preserved.

Needed:

- `isAtBottomRef` or equivalent state.
- `scrollHeight - clientHeight - scrollTop` threshold check.
- ResizeObserver or mutation-driven auto-follow when bottom-pinned.
- Guard against stealing scroll after user scrolls up.

### 1.3 No user-scroll intent tracking

References:

- T3Code tracks `isAtEnd`, debounces showing the scroll pill, and hides immediately when back at end.
- OpenCode marks scroll gestures via wheel/touch/pointer and distinguishes nested scrollables with `data-scrollable`.
- AionUI tracks `userScrolledRef`, `userInputActiveRef`, `lastProgrammaticScrollTimeRef`, wheel, pointer down, and scroll delta.

Our current implementation has no `onScroll`, `onWheel`, or pointer tracking in the timeline.

Consequences:

- If we add auto-scroll naively, it will fight the user.
- Tool `<pre>` scroll containers can cause parent auto-scroll conflicts later.
- There is no way to show a reliable "new output below" state.

Needed:

- Track wheel/pointer/touch input.
- Programmatic scroll guard window.
- Nested scrollable detection for tool/diff blocks.
- Bottom threshold constants.

### 1.4 No scroll-to-bottom affordance

References:

- T3Code has a centered floating pill: "Scroll to bottom" with chevron, shadow, border, hover transitions, pointer-events handling, and debounce to avoid flash during route switches.
- OpenCode has a compact floating button at bottom center with opacity/translate/scale transitions and a shadow stack.
- AionUI has a circular down button with border, hover scale, and optional gradient mask area.

Our current panel has no scroll-to-bottom button.

Needed:

- Floating scroll affordance shown only when user is away from bottom.
- Debounced show, immediate hide.
- Absolute positioning above composer so it does not cover input.
- Keyboard accessible button with label/title.

### 1.5 No scroll anchoring for row expansion/collapse

References:

- T3Code suppresses `maintainScrollAtEnd` for two animation frames when folding a turn so the clicked fold row does not jump.
- T3Code `WorkGroupSection` captures the section bottom before expanding and adjusts nearest vertical scroller by delta after expansion.
- OpenCode captures a visible prepend anchor before loading history and restores it across many frames until stable.
- OpenCode pins visible indexes during huge size changes so the virtualizer does not yank the viewport.

Our current panel has no fold/expand features, so no anchor preservation exists.

This becomes important as soon as we add:

- tool group expand/collapse,
- diff expand/collapse,
- long user message "show more",
- image preview loading,
- async markdown/code block measurement,
- history pagination.

Needed:

- `data-scroll-anchor-ignore` for buttons that should not become browser scroll anchors.
- `overflow-anchor: none` on list and row containers.
- Anchor capture/restore utilities before adding collapsible rows.

### 1.6 No history/prepend pagination scroll preservation

References:

- OpenCode has explicit `capturePrependAnchor`, `restorePrependAnchor`, and multi-frame stabilization while older messages load above.
- OpenCode's hash-scroll hook loads more history until the target message exists.

Our timeline has no history pagination and no scroll preservation for prepending.

Needed later:

- Capture first visible row key + offset.
- Restore after loading older rows.
- Stop restoring after stable frames or max frames.
- Integrate with message-id links.

### 1.7 No hash/message jump behavior

References:

- OpenCode supports hash-based message navigation with `useSessionHashScroll`.
- AionUI supports `targetMessageId` from route state and a custom `CHAT_MESSAGE_JUMP_EVENT`.
- Both highlight or activate the target and scroll it into view.

Our current rows have no stable DOM ids like `message-${id}`, no URL hash parsing, no jump event, and no highlight state.

Needed:

- Stable `id` per message row.
- `scrollElementIntoView` API.
- Temporary highlight style.
- Optional hash cleanup after navigation.

### 1.8 No scroll state persistence

References:

- OpenCode has `createScrollPersistence` with debounced flush per session/tab.
- OpenCode caches virtualizer measurements and open tool state per session key.

Our panel resets scroll state on route changes and has no cached measurements.

Needed:

- Per conversation scroll state if user returns to previous conversation.
- Decide rule: normal route open starts bottom; returning through history may restore exact scroll.
- Cache row measurements if virtualized.

## 2. Timeline architecture and data-model gaps

### 2.1 Row model is too small

Our row model:

```txt
message
request
event
```

Reference row models include:

T3Code:

```txt
message
work
turn-fold
proposed-plan
working
```

OpenCode projection includes rows for:

```txt
user messages
assistant parts
tool parts
reasoning/thinking
compaction
summary diffs
retry
turn gaps
context/tool groups
```

AionUI processed list includes:

```txt
normal message
file_summary
tool_summary
artifact
cron_trigger
skill_suggest
```

Missing row types we likely need:

- `working` / active turn progress row.
- `thinking` / reasoning summary row.
- `tool_call` row with status, title, compact preview, raw details.
- `tool_result` row with success/error tone.
- `tool_group` row for compact completed tool calls.
- `file_diff_summary` row.
- `changed_files` row.
- `proposed_plan` row.
- `plan_step` / todo row.
- `queue_item` row.
- `retry` row.
- `revert_checkpoint` row.
- `compaction` row with summary display.
- `artifact` row for generated docs/files/previews.
- `image` row with real preview.
- `error` row with retry/diagnostic actions.
- `system_notice` row distinct from provider error.
- `parent_child_handoff` row or session breadcrumb.

### 2.2 Turns are not first-class in the UI

References:

- T3Code computes durations from user boundary to assistant completion and folds settled turns.
- OpenCode groups timeline by provider turn and can show turn-level diffs, retry, progress, title, parent/child context.
- AionUI groups output into turn-like visual summaries by position and message type.

Our UI has `turnId` only as optional metadata on assistant rows. There is no turn-level grouping, lifecycle, duration, or fold state.

Needed:

- Introduce a `turn` projection layer independent of raw messages.
- Map user prompt + assistant work + tools + terminal result into one turn group.
- Keep terminal/final assistant answer visible while folding intermediate work.
- Represent interrupted/failed/completed turn state visibly.

### 2.3 Work logs are not separate from final answer

References:

- T3Code distinguishes final assistant answer from work/tool rows and folds older work.
- OpenCode separates assistant text, parts, tool calls, diffs, and thinking.
- AionUI groups tool calls into summaries rather than showing every raw provider message.

Our `ProviderPart` dumps metadata or text in `<pre>`. This is technically visible but not product-quality.

Needed:

- Separate provider parts into typed rows.
- Compact finished tool calls.
- Show failed tools with error tone.
- Show raw JSON only behind a disclosure/debug affordance.

### 2.4 No changed-files/diff timeline summary

References:

- T3Code attaches `AssistantChangedFilesSection` under assistant answer, with file count, additions/deletions, collapse all, expand all, and View diff.
- OpenCode renders `TimelineDiffSummaryRow` with sticky header, show all/less, file path split into directory + filename, diff changes, chevron, and inline diff view.
- AionUI parses write-file results into `MessageFileChanges` summary rows.

Our panel has no diff-aware rendering.

Needed:

- Store/project file changes from provider events.
- Render compact changed-files summary.
- Add per-file expand/collapse and open diff action.
- Use sticky subheaders for long diff lists.
- Prevent expanded diff from destroying scroll position.

### 2.5 No artifact/rendered output rows

References:

- AionUI supports artifact rows like cron triggers and skill suggestions.
- T3Code has preview annotations and proposed-plan cards.
- OpenCode has session review/file tabs and side panels tied to timeline.

Our panel only shows messages, events, and references. It cannot show first-class app objects.

For our studio SaaS direction, likely artifacts should include:

- client record proposal,
- shoot checklist,
- deliverable/task/reminder,
- calendar item,
- invoice/payment action,
- image/contact sheet,
- script/shot-list/action board,
- file export,
- app action result.

### 2.6 Compaction exists but is visually under-modeled

References:

- T3Code has compaction/proposed-plan rows and event styling.
- OpenCode has `MessageDivider` for compaction and session turn compaction styling.

Our `eventTone()` calls anything containing "compacted" a `compaction` tone, but `EventRow` only visually differentiates `error` vs everything else. `compaction` is not styled specially.

Needed:

- Dedicated compaction row: checkpoint title, summary excerpt, token count, what was kept/dropped.
- Different icon and tone from generic system/error.

## 3. Message rendering gaps

### 3.1 No Markdown renderer

References:

- T3Code uses `ChatMarkdown` for user and assistant messages, including line-break behavior.
- OpenCode uses `@opencode-ai/ui/message-part` and rich message rendering.
- AionUI uses message text components with markdown styling classes.

Our text rendering is plain:

```tsx
<p className="whitespace-pre-wrap break-words">{text}</p>
```

Missing:

- Markdown headings/lists/tables/blockquotes.
- Code blocks.
- Inline code.
- Link handling.
- File/path linking.
- Skill mentions and terminal/context chips inline.
- Streaming-safe markdown behavior.

### 3.2 No syntax highlighting or code block actions

References do not all expose the same code block UI in the inspected files, but T3Code/OpenCode both route markdown through dedicated renderers that can support code blocks and file context.

Our panel cannot:

- copy a code block,
- wrap long code smartly,
- scroll code independently,
- show language labels,
- render patch/diff blocks properly,
- open referenced files from code blocks.

### 3.3 No message copy actions

References:

- T3Code has `MessageCopyButton`, with assistant copy hidden while streaming and hover/focus visibility.
- AionUI computes `aiCopyRowTextIds` so copy/timestamp row appears once per AI turn, not under every text chunk.
- OpenCode's UI message components expose user actions.

Our rows have no copy action for user text, assistant answer, tool output, code block, or raw event.

Needed:

- Copy button per message/answer, visible on hover/focus.
- Copy raw vs copy formatted maybe later.
- Hide or disable while streaming if text unstable.

### 3.4 No timestamps polish

Our rows show `HH:MM` always in the card header.

References:

- T3Code shows timestamps as subtle hover/focus metadata and tooltips with full formatted time.
- AionUI defers AI copy/timestamp row until turn finish to avoid layout shift.
- OpenCode has title/status timestamp and stable row rendering.

Needed:

- Full timestamp tooltip.
- Hide metadata until hover/focus for assistant rows.
- Avoid timestamp/copy row flashing during streaming.
- Use tabular numbers consistently.

### 3.5 No long user-message collapse

Reference:

- T3Code collapses user messages over 600 characters or 8 lines with mask fade, `Show full message`, and `Show less`.

Our user bubbles can become huge and push context offscreen.

Needed:

- Collapse long user/context messages.
- Fade mask and explicit expand/collapse button.
- Scroll-anchor-ignore on expand button.
- Preserve viewport on expand/collapse.

### 3.6 No image preview/lightbox

References:

- T3Code has `ExpandedImageDialog` and preview annotation cards.
- AionUI wraps all messages in `Image.PreviewGroup` with zoom/original/rotate actions.

Our `image` part is a text card with `IconPhoto`, label, path, and MIME type. No thumbnail, no preview, no lightbox.

Needed:

- Persist/load thumbnail preview URL for local images.
- Render thumbnails inline.
- Click to expanded viewer.
- Group images per message for next/previous browsing.
- Show filename, size, MIME, failure state.

### 3.7 No attachment display quality

References:

- AionUI file and image components have real media preview and horizontal file lists in composer.
- T3Code preserves optimistic image blob preview URLs and hands them off when server messages arrive.

Our attachment rows show absolute path in monospace. That is useful for debugging but weak UX.

Needed:

- Use workspace-relative path where possible.
- Show file type icon/thumbnail.
- Show size and status.
- Click-to-open or reveal in Finder action.
- Avoid leaking long absolute paths as primary visual text.

### 3.8 No specialized error/retry cards

References:

- T3Code renders provider failures as timeline error rows and uses thread error banners.
- OpenCode has `SessionRetry` tied to active message.
- AionUI builds send failure errors and runtime state failures.

Our `EventRow` title is inferred from text content. There is no retry action or structured error metadata view.

Needed:

- Structured `error` row type.
- Retry failed send/turn action.
- Copy diagnostics action.
- Compact visible message + expandable raw details.

### 3.9 No thinking/reasoning presentation

References:

- T3Code has a `WorkingTimelineRow` with animated dots and elapsed timer.
- OpenCode has `TextShimmer`, `TextReveal`, and optional reasoning heading summaries.
- AionUI has `MessageThinking` and thinking-specific CSS module.

Our assistant rows only display status badges like `streaming`, and empty placeholders are hidden.

Needed:

- Active turn thinking row.
- Working duration timer.
- Reasoning heading/summary if provider emits it.
- Hide/reveal rules to avoid flicker.

## 4. Tool, diff, and provider-part gaps

### 4.1 Tool calls are raw cards, not readable UI

Our tool/provider parts render:

```tsx
<div>
  <label>Tool call</label>
  <pre>{text || JSON.stringify(metadata)}</pre>
</div>
```

References:

- T3Code normalizes tool labels, derives tool tone, groups compact tool logs, caps visible work entries, and shows expandable hidden count.
- OpenCode uses `ContextToolGroup`, `MessagePart`, and `Part` abstractions with default open state.
- AionUI groups tool messages into `MessageToolGroupSummary` and renders `MessageToolCall` / `MessageAcpToolCall` specialized components.

Needed:

- Tool icon per kind/status.
- Tool title derived from provider event.
- Command preview.
- Success/failure/neutral tone.
- Duration if available.
- Collapsible raw input/output.
- Compact group row for completed tool runs.

### 4.2 No command/terminal output rendering

References:

- T3Code has terminal context chips, terminal drawers, and terminal output contexts.
- OpenCode has terminal panels and terminal-focus behavior.
- AionUI has tool-call grouping and ACP tool call components.

Our `context_terminal` becomes a generic context card. Terminal output itself is not rendered as terminal-like content.

Needed:

- Terminal output row/chip.
- Monospace terminal block with max height and copy button.
- Collapse old/long output.
- Preserve parent scroll when scrolling nested terminal block.

### 4.3 No diff rendering

Already covered, but this is critical for coding-agent workflows.

Minimum parity:

- show file path,
- additions/deletions,
- changed file count,
- click to open diff panel,
- inline compact diff for one or few files.

## 5. Composer/timeline integration gaps

### 5.1 Pending approval UI is split and under-modeled

References:

- T3Code has composer pending panels: approvals, user inputs, actions, banners.
- OpenCode has separate permission/question docks above composer.
- AionUI has message-level permission components and sendbox runtime gating.

Our current split:

- `RequestRow` shows a pending/resolved badge.
- `PendingRequestLayer` likely handles action buttons separately.
- `SessionComposer` has `PendingRequestDock`.

Missing:

- Rich details per approval kind.
- Permission scope display.
- "accept once" vs "accept for session" styling.
- User-input questions with multi-step progress.
- Inline answered/resolved state in timeline.
- Pending request priority when multiple requests exist.
- Focus management when approval appears.

### 5.2 Queue is not timeline-aware

References:

- AionUI queue persists in `sessionStorage`, validates state, supports remove/reorder/pause/resume, defers after team upgrade, logs queue events, and pauses after failure.
- T3Code has plan follow-up and queue-like composer state integrated with banners and sending state.
- OpenCode has followup dock and explicit delivery/queue model in its agent instructions.

Our queue:

- Exists in `ComposerRegion` via `useComposerQueueStore`.
- Shows `ComposerQueuePanel` above composer.
- Sends busy conversation input to queue.
- No durable hydration after restart.
- No backend reorder persistence.
- Pause/resume is local only.
- Queue rows do not appear in timeline.
- Stop vs queue primary action conflict exists: when turn is active and composer has text, primary action becomes `queue`, hiding `stop`.

Needed:

- Queue item row in timeline or a persistent queue dock.
- Separate stop control from queue/send control, or prioritize stop.
- Durable queue hydration.
- Reorder/remove/edit UI.
- Failure state that pauses queue and prompts user.
- Queue execution log in timeline.

### 5.3 No composer banner stack

Reference:

- T3Code renders `ComposerBannerStack` above composer for provider status, plan followups, unavailable environment, warnings, etc.

Our composer has no equivalent banner stack outside the queue/pending dock.

Needed banners:

- provider disconnected/auth needed,
- selected workspace missing,
- runtime blocked by mode,
- queued item failed,
- usage limit/rate limit,
- model unavailable,
- attachment rejected,
- draft preserved after failure,
- quick capture available.

### 5.4 No revert/followup/todo docks

References:

- OpenCode has `session-followup-dock`, `session-revert-dock`, `session-todo-dock`, `session-permission-dock`, and `session-question-dock`.
- T3Code has proposed plan/followup banners and plan implementation flows.

Our composer lacks:

- Revert to previous message/turn dock.
- Follow-up queued command editor.
- Todo/plan execution dock.
- Child session/subagent dock.
- Inline continuation controls.

### 5.5 No type-to-focus composer keyboard behavior

Reference:

- T3Code has `shouldTypeToFocusComposer()` with selectors to avoid stealing typing from inputs, buttons, menus, dialogs, popovers, etc.
- OpenCode has terminal focus and keyboard handling at session level.

Our composer does not get global type-to-focus behavior.

Needed:

- Global keydown that focuses composer for plain character input.
- Exclusion selectors for editable/interactive/floating layers.
- Terminal-open exception.
- Respect IME composition.

### 5.6 Model/runtime controls are less real

References:

- T3Code selects provider/model with disabled reasons, provider statuses, active thread model, project default model, locked provider, and provider capabilities.
- AionUI model selector integrates with runtime config, thought level, assistant presets, mobile action sheet, and runtime stop-on-model-switch.
- OpenCode has agent/model/project/session controls in composer region.

Our model picker is hardcoded:

```ts
["gpt-5.5-thinking", "gpt-5.4", "gpt-5.4-mini"]
```

Needed:

- Provider-backed model list.
- Disabled reasons.
- Persisted per-workspace or per-conversation model.
- Runtime mode capability validation.
- Thought/effort selector if provider supports it.
- Stop running turn before provider/model switch if needed.

### 5.7 Mobile composer adaptation is absent

Reference:

- AionUI moves model selection into mobile action sheet and uses a compact plus launcher.
- AionUI CSS tunes sendbox padding, placeholder font, tools horizontal scroll, speech controls, and send button visibility on small widths.
- T3Code uses safe-area inset padding and responsive composer spacing.

Our desktop app is currently desktop-first; there is no mobile or narrow-window composer behavior beyond some max-width utility hiding.

Even for desktop Electron, narrow window support matters.

Needed:

- Overflow handling for mode/model/runtime controls.
- Compact toolbar mode under narrow widths.
- Primary stop/send button always visible.
- Horizontal tool scroll or overflow menu.
- Safe-area aware bottom padding if ever shipped to mobile/tablet.

## 6. Header, layout, and surrounding surface gaps

### 6.1 Header is not conversation-aware enough

References:

T3Code header includes:

- active thread title,
- project name,
- editor/script actions,
- right panel controls,
- provider status banners,
- thread error banner.

OpenCode session title area includes:

- sticky title inside scroll surface,
- parent/child session breadcrumb,
- spinner tied to active work,
- editable title,
- context usage,
- share/archive/delete menu,
- progress bar.

AionUI chat layout includes:

- model selector,
- cron manager,
- workspace metadata,
- associated conversations,
- add new conversation from workspace,
- runtime selectors.

Our `DesktopLayout` has top tabs and settings; the conversation content itself lacks a rich conversation-aware header.

Needed:

- Conversation title display and rename.
- Conversation status/progress.
- Workspace/current folder display.
- Provider/model/permission status in context.
- Optional parent/fork/branch breadcrumb.
- Archive/delete/share/export actions eventually.

### 6.2 No progress bar

Reference:

- OpenCode has a 2px session progress bar with `session-progress-whip` keyframes and agent-tint coloring.

Our panel only shows status text elsewhere and row status badges.

Needed:

- Slim progress indicator when running.
- Optional per-provider/agent tint.
- Smooth fade-out after completion.

### 6.3 No right-side contextual panels tied to timeline

References:

- T3Code has diff/preview/plan/right panel layouts.
- OpenCode has review/file tree/session side panel.
- AionUI has workspace/preview panels and minimap-related files.

Our diagnostics moved to Settings, which is correct for reducing clutter, but the conversation lacks product-side panels:

- diff panel,
- file preview panel,
- plan sidebar,
- workspace context panel,
- media/contact sheet panel,
- timeline minimap.

For our app, likely future panels:

- shoot plan/sidebar,
- client/project details,
- gallery/file preview,
- timeline minimap,
- task/deliverable board.

## 7. CSS and visual polish gaps

This section is intentionally detailed because many important reference behaviors are CSS-level, not data-level.

### 7.1 Missing scroll CSS primitives

References use combinations of:

- `overflow-anchor: none` on message containers/content.
- `overscroll-y-contain` in T3Code list.
- `scrollbar-gutter-both` in T3Code list.
- hidden scrollbars in OpenCode session turn CSS.
- edge-hugging scrollbar trick in AionUI: `-mx-20px px-20px`.
- nested `data-scrollable` detection in OpenCode.

Our current CSS/DOM:

- `ScrollArea` viewport has `size-full rounded-[inherit]` but no conversation-specific scroll behavior.
- Timeline content has `py-4`, `gap-3`, max width.
- No `overflow-anchor` control.
- No `overscroll-y-contain`.
- No `scrollbar-gutter`.
- No custom scroll-to-bottom overlay.

Needed:

```css
[data-conversation-timeline] {
  overflow-anchor: none;
  overscroll-behavior-y: contain;
  scrollbar-gutter: stable both-edges;
}

[data-conversation-row] {
  overflow-anchor: none;
}

[data-scroll-anchor-ignore] {
  overflow-anchor: none;
}
```

### 7.2 Our row visual hierarchy is too bubble-heavy

Our assistant rows are bordered bubbles with background:

```txt
assistant: bg desktop-soft + border
user: bg desktop-selected + border
max width: 82%
```

References:

- T3Code uses a centered rail but assistant answers are not always heavy bubbles; metadata/actions are subtle and hover-based.
- OpenCode treats the session turn as a full-width structured rail with parts, not chat bubbles everywhere.
- AionUI uses left/right alignment but groups tools/files/artifacts into their own card types.

Potential issue:

- Coding-agent/studio-agent output often needs full-width content: diffs, plans, file lists, timelines, scripts, shot lists, tables.
- `max-w-[82%]` will make wide structured content cramped.

Needed:

- User prompt can stay bubble-like.
- Assistant final answer should likely be full rail width or `max-w-full` with prose constraints inside.
- Tool/diff/artifact cards need full width.
- System/event rows should be centered but compact.

### 7.3 Missing hover/focus metadata transitions

References:

- T3Code assistant metadata row uses opacity `0` then `group-hover/assistant:opacity-100` and `focus-within:opacity-100`.
- OpenCode uses hover data-slot selectors for toggles.
- AionUI copy/timestamp rows are delayed until stable.

Our timestamps are always visible in row header. There are no hover/focus copy/action bars.

Needed:

- Hover action row with copy, retry, revert, open diff, show raw.
- Keep keyboard access with `focus-within`.
- Avoid layout shifts by reserving minimal metadata height or overlaying actions.

### 7.4 Missing shimmer/skeleton styles

References:

- AionUI has `MessageListSkeleton` with shimmer keyframes.
- OpenCode uses `TextShimmer`, `TextReveal`, and progress bar animations.
- T3Code has working dots and timers.

Our panel has no skeleton for loading conversations. `DesktopRouteStateView` has a route-loading state, but active conversation timeline does not show a message-list skeleton or shimmer.

Needed:

- Skeleton rows for conversation loading.
- Thinking shimmer row for provider start delay.
- Smooth fade/hide after completion.

### 7.5 Missing mobile/narrow-window typography CSS

Reference:

- AionUI `messages.css` tunes mobile message font to `14px`, line-height `1.4`, message spacing `16px`, and consistent line-height for user text.
- T3Code uses safe-area inset paddings in chat and input wrappers.

Our global font size is `13px`, message text is `14px leading-6`, and there is no mobile-specific conversation typography tuning.

Needed:

- Narrow-window breakpoints for message font, line-height, spacing.
- Composer toolbar overflow behavior.
- Safe area readiness if needed.

### 7.6 Missing sticky subheaders

References:

- T3Code changed-files header is sticky inside the changed-files section.
- OpenCode diff summary header uses sticky top offset.
- OpenCode session title is sticky at top of scroll surface with gradient background.

Our panel has no sticky timeline subheaders.

Needed for:

- long file diff lists,
- large tool groups,
- date separators,
- active conversation title/progress,
- section summaries.

### 7.7 Missing scroll button visual treatment

Reference CSS/details:

- T3Code: rounded pill, border, card background, shadow, hover border/text, pointer-events-none wrapper.
- OpenCode: compact 40x32 transparent wrapper, inner 32x24 rounded rectangle, backdrop blur, multi-layer shadow, opacity/translate/scale transitions.
- AionUI: circular 40px button, `shadow-lg`, hover background, hover scale, border, centered icon.

Our panel has none.

Recommendation:

- Use OpenCode's compact icon-only version for Electron desktop.
- Use T3Code's labeled pill if discoverability is more important during early UX.

### 7.8 Missing stop button animation / sendbox-specific CSS

AionUI has detailed sendbox CSS:

- Disabled send button overrides default component library disabled styling.
- Stop button removes default border/shadow.
- Stop button has `sendbox-stop-breathe` animation.
- Dark-mode-specific stop animation.
- Comment explicitly avoids `transform: scale()` because it clips on mobile rounded panels.
- Sendbox tools prevent layout jitter from theme hover transforms.
- Model/permission pills blend into the background.
- Mobile compact plus button and tool scrolling.
- Speech input waveform/loading states.

Our `ComposerPrimaryButton` has basic color switching. No stop animation. Also `queue` can hide `stop`.

Needed:

- Separate stop state visual language.
- Stop button visible while running.
- Animated but non-jittery running/stop affordance.
- Disabled send style that still looks intentional.
- Tool button hover styles that do not shift layout.

### 7.9 Missing design tokens for timeline semantics

Our CSS has general desktop tokens:

```css
--desktop-bg
--desktop-panel
--desktop-selected
--desktop-soft
--desktop-subtle
...
```

But no semantic timeline tokens:

- `--timeline-user-bg`
- `--timeline-assistant-bg`
- `--timeline-tool-bg`
- `--timeline-error-bg`
- `--timeline-diff-add`
- `--timeline-diff-delete`
- `--timeline-warning-bg`
- `--timeline-hover-action`
- `--timeline-scroll-overlay`

References rely heavily on semantic tokens/data slots.

Needed:

- Add semantic CSS variables for conversation/timeline states.
- Avoid hardcoding destructive/error rendering through generic `destructive` only.

## 8. Performance gaps

### 8.1 No virtualization

T3Code uses LegendList with estimated item size and maintain-at-end behavior.

OpenCode uses TanStack virtualizer with:

- `initialMeasurementsCache`,
- `estimateSize`,
- custom `scrollToFn`,
- `getItemKey`,
- `anchorTo: "end"`,
- `followOnAppend`,
- `scrollEndThreshold`,
- `scrollMargin`,
- `overscan`,
- `paddingEnd`,
- custom `rangeExtractor`,
- cached measurements on cleanup.

Our timeline renders all rows at once. This is fine for early testing, but it will not hold for long agent sessions with tool logs, diffs, images, and streaming deltas.

Needed:

- Pick LegendList or TanStack virtualizer.
- Add stable row keys.
- Add estimated row sizes.
- Preserve bottom anchoring and history anchor.
- Test streaming performance.

### 8.2 No structural sharing

T3Code has `computeStableMessagesTimelineRows()` and `useStableRows()` to reuse old row object references so unchanged rows do not re-render.

Our `projectConversationTimeline()` creates new row/part objects each render via `flatMap` and `.map()`.

Needed:

- Structural sharing by row id.
- Stable arrays where possible.
- Row-level memoization.
- Avoid rebuilding provider-part text/JSON on every render.

### 8.3 No row-local subscriptions or self-updating labels

T3Code's `WorkingTimer` updates its text node every second instead of causing React commits across the timeline.

OpenCode uses self-contained virtual rows and state localized to row/section.

Our future timer, progress, queue, and streaming labels should avoid rerendering the whole timeline.

Needed:

- Self-ticking timer component.
- Context for shared row callbacks.
- Row memoization.
- Avoid passing unstable closures to every row.

### 8.4 Raw JSON stringify in render path

`ProviderPart` calls `summarize(part.metadata)` during render. For large provider payloads this can be expensive and noisy.

Needed:

- Precompute compact summaries in projection.
- Lazy stringify only when raw details are expanded.
- Cap and syntax-highlight raw JSON in a debug disclosure.

### 8.5 No performance tests

OpenCode has dedicated performance E2E files:

- session timeline benchmark,
- tab switch benchmark,
- stream probe,
- stress fixture,
- visual tracking tests.

T3Code has timeline tests and component tests.

Our desktop app has unit tests around projection and composer, but no performance/regression tests for scroll or large timelines.

Needed:

- Unit tests for scroll state helpers.
- Component tests for scroll button visibility.
- Stress fixture with hundreds/thousands of rows.
- E2E/smoke for streaming at bottom and user-scroll-away behavior.

## 9. Accessibility and interaction gaps

### 9.1 Missing accessible action controls

References use buttons/tooltips/labels for copy, revert, retry, scroll, and more menus.

Our row currently has no actions. When adding actions, ensure:

- `aria-label` for icon buttons.
- `aria-expanded` for collapsible rows.
- `aria-live` handling for streaming content.
- Keyboard reachable hover actions via `focus-within`.
- Tooltips for hidden actions.

### 9.2 No streaming announcement policy

OpenCode explicitly uses `aria-live="off"` in message content areas to avoid noisy screen reader spam.

Our timeline does not define `aria-live`. Browser/screen-reader behavior may be noisy or inconsistent once streaming updates frequently.

Needed:

- Decide aria-live region strategy.
- Probably keep message body `aria-live="off"` during streaming, with a separate status announcement if needed.

### 9.3 No keyboard navigation between messages

References have message hash/jump and active message concepts. Our rows are passive.

Needed later:

- Jump to previous/next user message.
- Search result jump.
- Active highlight.
- Keyboard shortcut to copy/retry/revert current row.

### 9.4 No selection-reply behavior

AionUI includes `SelectionReplyButton` tied to selected message text.

Our panel has no selection-based reply/quote mechanism.

For our studio use-case, this is useful for:

- quoting script lines,
- asking about a pose/shot item,
- replying to a plan section,
- turning selected text into a task.

## 10. Loading, empty, and error states gaps

### 10.1 Timeline empty state is separate from stage, not list-aware

Our empty draft route shows "Where should we begin?" above composer. `ConversationTimeline` itself has no empty state.

T3Code `MessagesTimeline` has its own empty conversation copy when rows are empty and not working.

AionUI `MessageList` can render an `emptySlot` or skeleton.

Needed:

- Timeline-level empty state for loaded empty conversation.
- Draft empty state separate from conversation empty state.
- Loading skeleton inside the message list, not only route-level loading.

### 10.2 No provider-status banner in chat surface

T3Code renders `ProviderStatusBanner` and `ThreadErrorBanner` above the main content.

Our provider status lives in Settings panel, not in the chat surface.

This is okay for diagnostics, but user-facing blockers need to be visible near the composer:

- auth expired,
- provider unavailable,
- app-server unavailable,
- model disabled,
- workspace inaccessible,
- usage/rate limit.

### 10.3 No retry/recover flows in UI

References expose retry and failure states near the relevant message/turn.

Our timeline only shows text events and status badges.

Needed:

- Retry failed turn.
- Resume interrupted turn.
- Clear stuck running state if runtime disconnected.
- Open diagnostics from error row.

## 11. Missing features specifically useful for our app direction

The references are coding-agent apps, but our app is studio/client/shoot oriented. The gaps below matter even more for us:

### 11.1 Visual/media-first messages

We need better than text/file refs:

- image grid rows,
- contact sheet row,
- camera/card import row,
- before/after comparison row,
- video frame strip row,
- shot reference row,
- gallery delivery preview row.

Reference inspiration:

- AionUI image preview group.
- T3Code expanded image dialog.
- T3Code preview annotation cards.

### 11.2 Timeline actions as app actions

We need first-class rows for:

- create client,
- create shoot,
- schedule event,
- create invoice,
- create task/reminder,
- attach files to project,
- generate shot list,
- save script.

Current `event` row is too weak for this.

### 11.3 Persistent context chips

References have terminal/file/context chips and composer pending contexts.

For us, context chips should include:

- client,
- project,
- shoot,
- deliverable,
- invoice,
- calendar event,
- folder,
- image/video file,
- contact/person.

Current `context` part is generic and path-oriented.

### 11.4 Conversation minimap/title navigation

AionUI has `ConversationTitleMinimap` files and message jump mechanics.

For long studio planning conversations, we likely need:

- section headings generated from conversation,
- jump to deliverables/tasks/images,
- search within conversation,
- minimap or outline.

## 12. Concrete component-by-component comparison

## `ConversationStage.tsx`

Current:

- Owns vertical layout: timeline, pending requests, composer.
- Composer is always below timeline with `pt-4`.
- No scroll button slot.
- No banner slot.
- No status/header slot.
- No right panel/side detail slot.

Missing compared to references:

- T3Code-style provider and thread error banners above timeline.
- OpenCode-style sticky session title/progress inside scroll surface.
- AionUI-style empty/loading slot integration.
- Scroll-to-bottom overlay slot.
- Composer banner stack slot.
- Conversation-level toolbar/header.

Recommended future props:

```ts
conversationHeader?: ReactNode
statusBanner?: ReactNode
scrollOverlay?: ReactNode
composerBanners?: ReactNode
sidePanel?: ReactNode
timelineEmptyState?: ReactNode
timelineLoadingState?: ReactNode
```

## `ConversationTimeline.tsx`

Current:

- Thin wrapper around `ScrollArea`.
- Direct row map.
- Fixed center rail `max-w-[980px]`.
- Gap-based layout.

Missing:

- viewport ref,
- content ref,
- scroll state,
- virtualizer/list adapter,
- initial bottom scroll,
- maintain at bottom,
- scroll button trigger,
- user scroll intent,
- message id anchors,
- visible target tracking,
- resize observer,
- nested scroll handling,
- skeleton/empty state,
- top/bottom spacers tuned for composer.

Recommended next abstraction:

```txt
ConversationTimeline
  useConversationTimelineScroll
  ConversationVirtualList or ConversationPlainList adapter
  ConversationScrollToBottomButton
  ConversationTimelineEmptyState
```

## `TimelineRow.tsx`

Current:

- Single component handles message/request/event.
- User/assistant bubble style.
- Always visible role/time header.
- Plain text and generic reference/provider parts.

Missing:

- separate row components by type,
- memoization,
- row action bar,
- markdown renderer,
- image thumbnails,
- diff/file summary rows,
- tool group rows,
- thinking/working rows,
- copy buttons,
- retry/revert buttons,
- collapsible long user messages,
- hover/focus metadata,
- timestamp tooltip,
- raw provider disclosure,
- ARIA state for expandable rows.

Recommended split:

```txt
TimelineRow
  UserMessageRow
  AssistantMessageRow
  WorkingRow
  ThinkingRow
  ToolCallRow
  ToolGroupRow
  DiffSummaryRow
  FileReferenceRow
  ImageGridRow
  ApprovalRow
  ErrorRow
  CompactionRow
  QueueItemRow
  AppActionRow
```

## `conversationTimelineModel.ts`

Current:

- Projects from compatibility transcript + DB message parts.
- Converts composer payload into file/image/context parts.
- Converts tool/approval/raw DB parts into simple provider parts.
- Infers event tone/title from raw text matching.

Missing:

- turn grouping,
- stable row structural sharing,
- duration calculation,
- terminal assistant answer detection,
- folding rules,
- tool grouping,
- changed-file extraction,
- artifact projection,
- queue projection,
- retry/error metadata projection,
- target anchor metadata,
- active/settled turn state,
- provider-specific part adapters.

Recommended projection shape:

```ts
type ConversationTimelineRow =
  | UserMessageRow
  | AssistantMessageRow
  | WorkingRow
  | ThinkingRow
  | ToolRow
  | ToolGroupRow
  | DiffSummaryRow
  | ApprovalRow
  | ErrorRow
  | QueueRow
  | CompactionRow
  | ArtifactRow
  | AppActionRow
```

Keep the renderer dumb. Put grouping/collapse defaults in projection/model.

## `ComposerPrimaryButton.tsx`

Current issue:

```ts
if (input.queueActive && input.hasText && !input.blocked) return "queue";
if (input.turnActive) return "stop";
```

When a turn is active and the user typed text, the button becomes Queue and Stop disappears.

References:

- AionUI has dedicated stop button classes and animation.
- T3Code and AionUI keep interrupt/stop flows visible while running.

Needed:

- Stop must not be hidden by queue.
- Either stop wins, or send/queue and stop are separate controls.
- Best UX: show stop as a persistent secondary running control; primary can queue typed followup.

## 13. Suggested implementation order

### Phase A — Scroll correctness before new visuals

1. Add `useConversationTimelineScroll`.
2. Add viewport/content refs.
3. Add initial scroll-to-bottom.
4. Add bottom detection and user-scroll guard.
5. Add ResizeObserver auto-follow.
6. Add scroll-to-bottom button.
7. Add `overflow-anchor: none`, `overscroll-y-contain`, and scrollbar-gutter styling.
8. Add tests for bottom detection and button visibility.

This gives immediate UX improvement and prevents future expandable rows from breaking scroll.

### Phase B — Message rendering basics

1. Add Markdown renderer for text parts.
2. Add copy button for user/assistant text.
3. Add timestamp tooltip and hover/focus metadata.
4. Add long user-message collapse.
5. Add image thumbnail + lightbox for image parts.
6. Add raw provider disclosure instead of always dumping JSON.

### Phase C — Tool/diff rows

1. Expand DB/projection part types for first-class file/image/context/tool/diff rows.
2. Add `ToolCallRow` and `ToolGroupRow`.
3. Add `ChangedFilesRow` / `DiffSummaryRow`.
4. Add compact completed-turn folding.
5. Add scroll anchoring for expand/collapse.

### Phase D — Active turn and failure UX

1. Add `WorkingRow` with animated dots and elapsed timer.
2. Add top progress bar or subtle running indicator.
3. Add structured error row with retry/copy diagnostics.
4. Add retry/resume/interrupted flow.
5. Add provider status banner near composer.

### Phase E — Queue and pending request parity

1. Fix stop-vs-queue conflict.
2. Hydrate queue durably.
3. Add reorder/remove/edit/pause/resume UI.
4. Add queue row or persistent queue dock.
5. Add rich approval/user-input panels.
6. Add banner stack.

### Phase F — Performance

1. Add structural row sharing.
2. Add virtualization once row count grows.
3. Cache measurements by conversation id.
4. Add stress fixtures and scroll E2E.

## 14. Quick wins we can do immediately

These are low-risk and should not require changing the entire architecture:

1. **Fix primary action priority** so Stop is always reachable.
2. **Add scroll-to-bottom button** with a basic custom hook.
3. **Initial scroll to bottom** on conversation load.
4. **Auto-follow while pinned to bottom** using ResizeObserver.
5. **Add `overflow-anchor: none`** to timeline content and rows.
6. **Add Markdown renderer** for `text` parts.
7. **Add copy button** to message rows.
8. **Make `compaction` tone visually distinct** in `EventRow`.
9. **Add long-message collapse** for user rows.
10. **Convert image part from reference card to thumbnail card** when local preview is available.
11. **Add hover/focus metadata row** instead of always-visible row header for assistant messages.
12. **Add skeleton rows** for route conversation loading.

## 15. High-confidence missing CSS checklist

Add or design equivalents for:

- `[data-conversation-timeline] { overflow-anchor: none; overscroll-behavior-y: contain; }`
- stable scrollbar gutter or hidden scrollbar decision.
- bottom spacer so last message is not glued to composer.
- scroll-to-bottom floating button/pill classes.
- hover/focus row action opacity transitions.
- long-message fade mask.
- thinking shimmer/dots animation.
- running progress bar keyframes.
- stop button breathing animation without transform scale.
- sticky headers for diff/tool groups.
- mobile/narrow typography overrides.
- nested scrollable tool/diff blocks with `data-scrollable`.
- selected/jump-highlight row style.
- skeleton shimmer keyframes.
- semantic timeline CSS variables.

## 16. Traycer addendum

Traycer is probably the most directly useful reference for our immediate desktop conversation-panel work because it is React + Vite + shadcn/Tailwind, closer to our renderer stack than OpenCode's Solid app.

### 16.1 Traycer's core chat structure

Traycer's main chat surface is:

```txt
ChatMessages
  -> VirtuosoMessageList
    -> ChatItemContent
      -> ChatMessage
        -> AssistantMessageBody | UserMessageBody | special segment
  -> ChatUserMessageMinimap
  -> ScrollToBottomChip
```

The most important files are:

- `chat-messages.tsx`: virtualized transcript owner, scroll intent owner, scroll restoration owner, minimap owner.
- `chat-messages-virtuoso-helpers.ts`: pure scroll-policy classifier and message jump helpers.
- `chat-message.tsx`: role-level row selection and action plumbing.
- `chat-message-assistant-body.tsx`: assistant segment rendering, elapsed footer, copy/fork actions, run indicator.
- `chat-message-user-body.tsx`: user body, attachments, inline editing, copy/edit/delete, overflow collapse.
- `rendered-messages.ts`: raw protocol/event data to stable UI message model.

Compared to our current `ConversationTimeline -> rows.map(TimelineRow)` implementation, Traycer has a much cleaner split:

```txt
raw protocol state -> rendered message model -> virtual list -> role body -> segment components
```

We currently mix projection, role rendering, provider-part display, and UI assumptions into a much smaller model.

### 16.2 Traycer scroll system — additional gaps beyond the first report

Traycer does not use a naive scroll container. It uses `@virtuoso.dev/message-list` with a strong scroll policy layer.

Important patterns we lack:

1. **Scroll modifiers are classified from data changes.** `classifyChatScrollPolicy()` decides what to do for first render, submitted user messages, append-only changes, trailing assistant streaming changes, suffix removals, and branch resets. Our app has no concept of different scroll behavior for different timeline mutations.
2. **Bottom following is intent, not measurement.** Traycer explicitly comments that measured `isAtBottom` is not user intent. It only re-pins when the user scrolls down or drags the scrollbar down. Our current panel has no intent model at all.
3. **User gestures cancel smooth scrolling.** Wheel-up, PageUp, Home, touch drag away from tail, and other unpin gestures cancel Virtuoso smooth scroll so the list does not fight the user. We have no programmatic scroll cancellation path.
4. **Hidden/remounted panels restore reading position.** Traycer persists `bottomFollowing` and `activeUserMessageId` in `chat-scroll-state-cache.ts`, then restores bottom or row anchor when the tile reappears. Our timeline loses reading position on route/tab remount.
5. **Display-none restoration is defended across frames.** Traycer's scroll restoration adapter returns `defend` to repeatedly counter post-resize autoscroll races. This is more sophisticated than OpenCode/AionUI and directly relevant if our Electron app keeps tabs/panes alive while hidden.
6. **Active user message is computed from viewport.** The minimap rail is not decorative; it tracks the currently viewed human user message by probing the viewport reading line.
7. **Message jumps use item locations, not DOM querying.** `chatScrollLocationForMessage()` resolves message id to virtualizer item location with offset and behavior. Our future message jump should not depend on `document.getElementById` once virtualized.
8. **Measured item changes have their own scroll modifier.** Expanding/collapsing content can request a measured-item-change scroll behavior. Our future collapsible tool/diff/user-message rows need a similar signal.
9. **Transient missing rows are expected.** `chatComputeItemKey()` handles `undefined` rows emitted by Virtuoso during transient data shrink. This is a very specific robustness detail we would miss if we build naive virtualization.

Traycer should change the earlier Phase A recommendation: instead of writing a tiny custom scroll hook and then replacing it later, we should seriously consider building the scroll abstraction with an eventual virtual-list API from the start:

```txt
ConversationTimelineScrollController
  classify data mutation -> scroll policy
  own bottom-follow intent
  own scroll restoration
  expose jumpToMessage / jumpToBottom
  expose requestMeasuredItemChange
```

### 16.3 Traycer minimap — stronger than the AionUI minimap note

Earlier I noted that AionUI had minimap-related files. Traycer has a complete user-message minimap:

- compact rail in the top-right of chat,
- samples to max 120 markers,
- active marker based on viewport,
- hover/focus overlay listbox,
- overlay items show two-line previews of user messages,
- overlay clamps to viewport/parent bounds using CSS variables,
- active option scrolls into center,
- `role="listbox"` and `role="option"` semantics,
- hidden during `traycer-panel-resizing`.

Our report's earlier `Conversation minimap/title navigation` point should be upgraded from nice-to-have to **high-value for long planning conversations**.

For our studio app, the minimap does not need to show every user prompt only. It could show:

- user prompts,
- generated plans,
- client/shoot/invoice actions,
- file/image drops,
- decision points,
- approvals,
- failed turns.

A Traycer-like minimap would solve long conversation navigation much better than a simple search box.

### 16.4 Traycer row performance and resize behavior

Traycer has a very specific optimization we are missing entirely:

```txt
During panel resize, add `traycer-panel-resizing` to <html>.
Rows opt into `[.traycer-panel-resizing_&]:...` behavior.
Visible transcript rows use content containment/intrinsic sizes to avoid massive re-wrap/re-raster work during drag.
Overlays hide during resize.
```

In `ChatItemContent`, each row uses:

- `contain: layout paint style`,
- `contain-intrinsic-size: auto 8rem` for user rows,
- `contain-intrinsic-size: auto 14rem` for assistant rows.

Traycer's `panel-resizing-class.ts` explains that expensive surfaces freeze during drag because otherwise every pointermove can reflow all visible panes and spike GPU memory.

Our current app has no panel-resizing freeze concept. If we add split panes, side panels, diff panels, or multi-column chat layouts, this matters.

Needed:

- global `desktop-panel-resizing` class during pane resize,
- hide expensive overlays while resizing,
- `content-visibility` / containment strategy for transcript rows,
- one final measure/reflow after resize ends.

### 16.5 Traycer assistant body gaps

Traycer's `AssistantMessageBody` is not one markdown blob. It renders many segment types:

- `TextSegment`,
- `ReasoningSegment`,
- `ToolSegment`,
- `CommandSegment`,
- `FileChangeSegment`,
- `FileChangeGroupSegment`,
- `PlanSegment`,
- `TodoSegment`,
- `ErrorSegment`,
- `CompactionSegment`,
- `ArtifactCardSegment`,
- `SubagentSegment`,
- `InterviewSegment`,
- `ResolvedApprovalSegment`,
- activity groups.

It also has:

- an in-progress indicator before first token,
- trailing run indicator while content is streaming,
- elapsed footer after completion,
- provider/model metadata in tooltip,
- reply-only copy button that excludes reasoning/tools/file changes,
- fork conversation action.

Our assistant row has only:

- text part,
- generic file/image/context card,
- generic provider part,
- status badge.

New gaps to add:

- no reply-only copy that excludes work logs,
- no elapsed footer with provider/model metadata,
- no fork/branch action from a message,
- no segment abstraction,
- no separate reasoning segment,
- no plan/todo/interview/subagent segments,
- no active run indicator once content has started streaming.

### 16.6 Traycer user body gaps

Traycer's `UserMessageBody` is very mature:

- handles normal human user messages,
- handles user-role messages sent by another agent differently,
- renders attachments before body,
- supports inline editing using the same composer editor,
- supports copy/edit/delete actions,
- copy can preserve structured composer content,
- long messages are measured by `ResizeObserver` and clamped to 300px with a mask fade,
- action chip floats over the bubble's bottom-right border instead of reserving a row,
- agent-sent user messages render as operational cards with sender/open-agent affordance.

Our user row lacks all of this except basic alignment and text.

Specific additions we should borrow:

- measure real rendered height instead of only character/line count for collapse,
- use structured content renderer for saved prompts,
- inline edit user prompt with same composer extensions,
- floating action chip that does not create a hover gap,
- treat agent-to-agent messages differently from human messages.

For our app, agent-to-agent messages map well to future multi-agent studio flows: editor agent, scheduler agent, finance agent, client-support agent, etc.

### 16.7 Traycer activity grouping

Traycer's `buildChatActivityTimeline()` groups operational activity into compact activity groups. It counts and summarizes:

- explored files,
- read files,
- searched places,
- edited files,
- ran commands,
- ran hooks,
- spawned subagents,
- approved/denied requests,
- used tools.

It also promotes certain segments out of groups:

- reasoning is first-class inline,
- completed interviews become answered-question summaries,
- subagents can become promoted segments,
- agent-message-send tool calls are not hidden in a generic group.

Our tool rendering is raw. We need a similar grouping layer, but adapted to studio work:

- imported images,
- analyzed references,
- generated script sections,
- created tasks,
- scheduled events,
- updated invoices,
- changed client/project records,
- exported files.

Activity groups are the answer to the "too many tool calls" problem. Do not show every internal tool event as its own large card.

### 16.8 Traycer lower dock is a better pattern for queue + pinned context

Traycer's `ChatLowerDock` combines three composer-adjacent operational panels:

1. queued messages,
2. pinned todo/restore stack,
3. active agents panel.

All share a unified top dock container above the composer:

```txt
ChatLowerDock
  -> QueuedMessagePanel
  -> PinnedStackSections
      -> PinnedTodoPanel
      -> ChatAccumulatedChangesPanel
  -> ActiveAgentsPanel
```

Our current composer area has separate pending/queue surfaces but no unified lower dock concept.

Traycer's lower dock pattern is directly useful for us. Our equivalent could be:

```txt
ConversationLowerDock
  -> QueuedPromptPanel
  -> PendingApprovalPanel
  -> ActiveWorkPanel
  -> PinnedPlanPanel
  -> PinnedTasksPanel
  -> AccumulatedChangesPanel
  -> CurrentContextPanel
```

This would keep timeline messages clean while still surfacing operational state close to the composer.

### 16.9 Traycer queue is richer than our queue and AionUI's UI shape

Traycer's `QueuedMessagePanel` has:

- collapsible queue header,
- running/paused status,
- live pulse when queue is running,
- count summary,
- owner/read-only state,
- resume button for paused queue,
- drag-and-drop reorder via `@dnd-kit`,
- per-row scroll into view when editing,
- edit/delete/cancel/steer-now/abort-steer actions,
- read-only received agent-to-agent queue items,
- drop-line previews,
- queue item content preview,
- locked steering states.

Our queue currently lacks:

- durable host-backed model,
- DnD reorder,
- owner/read-only concept,
- paused/running visible status,
- steer-now / abort-steer,
- received agent-to-agent queue items,
- editing row scroll-into-view,
- collapsed header summary.

Traycer suggests we should not just make our existing `ComposerQueuePanel` prettier. We need a richer queue state model.

### 16.10 Traycer pinned stack: todo + accumulated changes

Traycer has pinned context above composer:

- `PinnedTodoPanel`: active todo summary, progress counts, active item, status icons, collapsible list.
- `ChatAccumulatedChangesPanel`: all changed files across the chat, additions/deletions, Review all, Undo all, per-row undo, revert artifact checkbox.
- `ActiveAgentsPanel`: running descendants and stop-all behavior.

Our report already said we need todo/diff docks. Traycer makes this more concrete:

- plans/todos should not only appear once in timeline; the active todo summary should stay pinned above composer while the agent works.
- file changes should have a cumulative panel, not only per-turn diff cards.
- active agents/subagents should be stoppable from the lower dock, not hidden in raw tool logs.

For our studio app, equivalent pinned panels could be:

- active shoot checklist,
- active deliverable checklist,
- accumulated edits/files produced,
- active external sync/import tasks,
- active sub-agents/workers,
- pending client-facing actions.

### 16.11 Traycer stop controls

Traycer's `AgentStopButton` is host-aware:

- stops the agent on its own host,
- handles local/global client vs transient host client,
- disables with tooltip if host unreachable,
- pending state uses `AgentSpinningDots`,
- supports icon-only and labeled modes.

Our stop is currently local to the primary composer button and can disappear behind Queue.

Minimum borrow:

- stop should be independent of send/queue,
- stop can show pending spinner while cancelling,
- stop should be disabled with reason when runtime/host unreachable,
- future multi-agent stops need per-agent and stop-all variants.

### 16.12 Traycer tests reveal the expected quality bar

Traycer has tests around:

- chat messages,
- transient rows,
- Virtuoso helpers,
- minimap items,
- user body,
- progress icon,
- queue surface,
- queue DnD reorder,
- lower dock,
- active agents panel,
- accumulated changes panel,
- pinned stack,
- rendered messages store,
- chat queue reconciler.

Our existing tests cover projection and composer basics but not this level of UI behavior.

New test targets after borrowing Traycer patterns:

- scroll policy classifier,
- bottom follow intent transitions,
- scroll state restore for hidden/remounted panel,
- minimap active item selection,
- queue reorder/edit/delete behavior,
- long user message collapse,
- assistant reply-only copy,
- activity group summary,
- active run indicator before first token and after first token,
- lower dock visibility composition.

### 16.13 Updated implementation priority after Traycer

Traycer changes my recommendation. The strongest implementation order is now:

1. **Fix stop visibility immediately.** Stop must be independent from queue/send.
2. **Introduce a scroll controller and policy classifier.** Do not hardcode scroll behavior inside the timeline component.
3. **Add a virtual list adapter early.** Use Virtuoso Message List, LegendList, or a wrapper that lets us swap later. The API should support scroll modifiers and item-location jumps.
4. **Add scroll-to-bottom chip and bottom-follow intent.** Use Traycer's user-intent model, not pure `isAtBottom` measurement.
5. **Add scroll state cache keyed by conversation/tab instance.** Restore bottom-follow or active user row.
6. **Add row model/segment abstraction.** Move away from generic provider parts.
7. **Add assistant/user body parity.** Assistant segments + elapsed footer; user body collapse/copy/edit.
8. **Add lower dock.** Queue + pending approvals + pinned active plan/tasks + active work.
9. **Add minimap once virtualized row jump exists.** This is high-value but depends on stable message indexing.
10. **Add performance/resize protections.** Panel-resizing class, content containment, overlay hiding.

### 16.14 Traycer-specific missing CSS checklist

Add to the CSS checklist:

- `.chat-scrollbar-native-thin` equivalent for dense nested panels.
- global `.desktop-panel-resizing` class during pane drag.
- row containment classes: `contain: layout paint style`.
- row `contain-intrinsic-size` defaults by role/type.
- hide overlays while panel resizing.
- scroll chip hidden state uses opacity + `pointer-events-none` + `tabIndex=-1`.
- minimap rail and overlay styles.
- minimap overlay viewport clamp CSS variables.
- user message mask fade based on measured overflow.
- floating user action chip over bubble border.
- lower dock connected rounded-top panel styles.
- active/live pulse indicators.

### 16.15 Bottom line after Traycer

Before reading Traycer, the report's scroll recommendation could be interpreted as "add auto-scroll and a button." Traycer proves that is too small.

For a serious desktop AI app, the conversation surface needs a **scroll policy engine** and a **work-surface lower dock**, not just a scroll hook.

Traycer is the clearest reference for our next implementation because it combines:

- virtualized chat,
- scroll restoration,
- user-message minimap,
- rich assistant/user bodies,
- queue/pinned lower dock,
- active agents stop controls,
- performance protections during resize,
- tests around these behaviors.

## 17. Final assessment

Our current component is architecturally pointed in the right direction but still at **MVP transcript** level.

The references are not just prettier; they solve hard product problems:

- preserving scroll under streaming and resizing,
- making long sessions fast,
- turning raw provider events into readable work history,
- keeping user control visible during running turns,
- showing failures and approvals where the user can act,
- integrating timeline, composer, model/runtime state, and side panels.

For our app, the most important next step is not adding more row colors. It is building the timeline as a real **work surface**:

```txt
messages + tools + files + images + actions + queue + approvals + errors + app objects
```

Right now we render conversation data. The references render an operational timeline.
