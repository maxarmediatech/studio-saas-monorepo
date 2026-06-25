# Conversation Surface Manual Test Plan

Status: draft for reviewer execution
Scope: `apps/experimental-desktop`
Branch: `feat/electron-opencode-app`
Checkpoint baseline: `ee527729 feat(experimental-desktop): harden conversation surface`
Current phase under review: Phase 5 timeline navigation/search/scroll persistence

## 1. Purpose

This document is the manual QA plan for the conversation surface work completed across Phase 0 through Phase 5. It is meant to be used after automated checks pass and before we call the conversation surface stable.

The goal is not only to confirm the UI looks good. The goal is to catch the failures that usually appear only in a real Electron runtime:

- streaming rows resizing while the user scrolls;
- queued requests entering/leaving the dock;
- approval requests arriving while a turn is active;
- stop/interruption races;
- late provider events after terminal states;
- long conversations with virtualized rows;
- search/minimap navigation changing scroll intent;
- conversation switching restoring the wrong scroll position.

## 2. Required setup

Use the Electron desktop app, not only unit tests.

Recommended checks before manual testing:

```bash
pnpm --filter @repo/experimental-desktop type-check
pnpm --filter @repo/experimental-desktop test
pnpm --filter @repo/experimental-desktop build
```

If the filtered build command is blocked by tooling, run the app/build through the normal local project command available in your terminal. The current Phase 5 change has already passed type-check and focused tests, but production build still needs confirmation after review.

Recommended runtime modes to test:

- normal sidecar/provider mode;
- mocked or predictable provider mode, if available;
- a workspace with enough files to trigger context/tool/file rows;
- at least one long conversation with 100+ timeline rows.

## 3. Phase coverage map

| Phase | Area | Must pass before sign-off |
| --- | --- | --- |
| Phase 0 | stop priority, scroll-to-latest chip, native timeline scroll primitives | stop never hidden by queue/send state; latest chip appears only when unpinned |
| Phase 1 | semantic timeline rows, row metadata, row stabilizer | row identity stable during streaming and rerenders |
| Phase 2 | message row rendering, markdown-ish text, copy actions, collapse user messages, assistant timing footer | message actions work and layout remains readable |
| Phase 3 | activity/media/app-action rows, lower dock, active work, approval, queue | dock reflects runtime state without duplicating composer actions |
| Phase 4 | TanStack virtualizer, anchor restore, long timeline performance | long conversations scroll smoothly without jump/reflow bugs |
| Hardening | turn lifecycle monotonicity, admitted request terminal projection, renderer reconciliation guard | terminal states cannot rewind; stale DB snapshots cannot overwrite live SSE state |
| Phase 5 | timeline search, landmark/minimap rail, scroll persistence | search/minimap jump correctly and conversation scroll state restores safely |

## 4. Global pass/fail rules

A feature passes only if all of these are true:

- no renderer crash;
- no main-process crash;
- no duplicate assistant/user rows;
- no row visibly jumps unless the user explicitly navigates;
- no terminal turn returns to running/streaming/pending;
- no queue item disappears without being sent/canceled/removed;
- no approval card remains actionable after timeout, decline, cancel, or turn completion;
- no scroll-to-bottom behavior fights the user after they intentionally scroll up;
- no search/minimap jump is treated as permission to follow the newest streaming output.

## 5. Basic conversation smoke test

### Steps

1. Launch the Electron app.
2. Select a valid workspace.
3. Start a new conversation.
4. Send: `Give me a short summary of this workspace.`
5. Wait for the assistant response to complete.
6. Send a follow-up: `List three files that look important.`
7. Wait for completion.

### Expected

- Initial empty state appears before the first send.
- Composer accepts input and sends normally.
- A user row appears immediately after send.
- Assistant row streams or appears without duplicate placeholders.
- Timeline stays pinned to latest while the user has not scrolled away.
- The latest chip is hidden while already near the bottom.
- After completion, the row footer/status no longer looks active.
- The lower dock should not show stale active work after completion.

### Failure signs

- Assistant response creates multiple assistant rows for one turn.
- Conversation status remains active after completion.
- Latest chip appears while already at the bottom.
- Composer stays disabled after completion.

## 6. Phase 0: stop and latest behavior

### 6.1 Stop priority while running

Steps:

1. Send a prompt likely to stream for several seconds: `Explain this project in detail. Include architecture, files, risks, and next steps.`
2. While the assistant is responding, inspect the composer primary action.
3. Click stop/interruption.

Expected:

- Stop action is visible while the turn is active.
- Stop has priority over send/queue affordances.
- Clicking stop interrupts the active turn.
- Assistant message ends in an interrupted/canceled state, not running.
- Composer returns to editable state.
- Lower dock active work clears.

Failure signs:

- Stop is replaced by send or queue while a turn is active.
- Stop click does nothing.
- Turn returns to running after stop.
- A late assistant delta continues appending after stop.

### 6.2 Latest chip while unpinned

Steps:

1. Open a conversation with enough rows to scroll.
2. Scroll upward away from the latest message.
3. Send or wait for a new assistant update.
4. Observe the latest chip.
5. Click `Latest`.

Expected:

- Latest chip appears only after scrolling away from bottom.
- New streaming output does not yank the viewport to the bottom while unpinned.
- Clicking Latest scrolls to the end and hides the chip.
- After clicking Latest, new streaming output follows bottom again.

Failure signs:

- View jumps to bottom while user is reading older rows.
- Latest chip never appears.
- Latest chip remains visible after jumping to bottom.

## 7. Phase 1: timeline row model stability

### Steps

1. Start a conversation with at least three user/assistant turns.
2. While an assistant answer streams, watch the currently streaming row.
3. Trigger UI rerenders: resize the window, open/close settings/sidebar if available, toggle theme if available.
4. Continue the conversation with two follow-ups.

### Expected

- Existing row order remains stable.
- Streaming assistant row updates in place.
- User rows do not collapse/reopen unexpectedly during unrelated rerenders.
- Timestamps/statuses remain attached to the correct rows.
- No duplicated operational/event rows.

### Failure signs

- The same message appears twice.
- Row actions attach to the wrong row.
- Scroll anchor is lost on every rerender.
- A streaming row remounts in a way that resets its measured height repeatedly.

## 8. Phase 2: message rendering and row actions

### 8.1 Markdown/code rendering

Send a prompt that returns markdown:

```text
Return a markdown response with:
- a heading
- a bullet list
- a numbered list
- inline code
- a fenced TypeScript code block
- a short quote
```

Expected:

- Markdown is readable and visually separated.
- Code block is readable and does not overflow the whole page.
- Inline code is styled differently from body text.
- Long lines do not break the layout.

### 8.2 Copy action

Steps:

1. Hover or focus an assistant row.
2. Use the copy action.
3. Paste into a temporary editor.

Expected:

- Copied text matches the assistant message content.
- Copy action does not accidentally copy UI labels, timestamps, or hidden control text.
- Copy action works for markdown and code rows.

### 8.3 Long user message collapse

Steps:

1. Send a long user message, at least 30 lines.
2. Observe the user row.
3. Expand/collapse it if the control appears.
4. Scroll while expanded and collapsed.

Expected:

- Long user message is collapsed by default or constrained to a readable height.
- Expand reveals the full content.
- Collapse restores compact height.
- Expanding/collapsing does not yank the viewport unpredictably.

Failure signs:

- Large user message consumes the entire timeline permanently.
- Expand/collapse causes the active assistant row to disappear or jump.

## 9. Phase 3: lower dock, queue, approvals, operational rows

### 9.1 Queue while active turn is running

Steps:

1. Send a long-running prompt.
2. Before it completes, type another prompt.
3. Submit it while the first turn is still active.

Expected:

- The second prompt is queued, not sent as a competing active turn.
- Queue state is visible in the lower dock, not only hidden inside composer.
- Queue item has remove/cancel affordance.
- Active turn remains the active work item.
- When first turn completes, queued request can run according to queue policy.

Failure signs:

- Two turns run simultaneously for the same conversation when not intended.
- Queue item disappears without running.
- Queue item remains after it already ran.
- Composer primary button shows contradictory send/queue state.

### 9.2 Pause/resume queue

Steps:

1. Create two queued prompts behind an active turn.
2. Pause queue.
3. Wait for active turn completion.
4. Resume queue.

Expected:

- Paused queue does not auto-run the next item.
- Resume makes the next queued item eligible to run.
- Queue count and visible items stay consistent.

### 9.3 Remove queued item

Steps:

1. Create at least one queued item.
2. Remove it from lower dock.

Expected:

- Item disappears from queue.
- It never sends later.
- Other queued items remain ordered correctly.

### 9.4 Approval request flow

Use a prompt/action that triggers an approval request, such as a file-changing/tool action if the provider supports it.

Steps:

1. Trigger approval.
2. Inspect the lower dock approval card.
3. Accept once.
4. Trigger another approval.
5. Decline/cancel once.

Expected:

- Approval appears in lower dock with clear action buttons.
- Accept sends the approval response and clears/updates the pending card.
- Decline/cancel sends the correct negative response and clears/updates the pending card.
- Timed-out approvals should no longer be actionable.
- Completion/failure/interruption expires pending approvals for that turn.

Failure signs:

- Approval remains active after the turn is completed or canceled.
- Clicking accept twice sends duplicate responses.
- Approval appears for a stale/completed turn.

### 9.5 Operational rows

During a tool/file/action-heavy response, inspect these row types:

- activity group rows;
- app action rows;
- media grid rows;
- event rows;
- request rows.

Expected:

- Operational rows are visually distinct from chat messages.
- Activity groups summarize noisy tool/file activity.
- Media grid rows do not break the width.
- Event/error rows are visible but not overly dominant.
- Request rows align with lower dock approval state.

## 10. Phase 4: virtualized timeline and scroll anchoring

### 10.1 Long conversation performance

Steps:

1. Open or create a conversation with 100+ rows.
2. Scroll from bottom to top.
3. Scroll from top to bottom.
4. Resize the window while midway through the list.
5. Toggle theme/sidebar/settings while midway through the list.

Expected:

- Scrolling remains smooth.
- Rows mount/unmount without blank holes.
- No overlapping rows.
- The viewport does not jump to bottom unless user asks.
- Resize preserves the reading position as much as possible.

Failure signs:

- Blank region appears in the middle of the timeline.
- Rows overlap.
- Scrollbar teleports while reading.
- CPU spikes heavily on simple scroll.

### 10.2 Streaming while unpinned

Steps:

1. Start a long-running assistant response.
2. Scroll upward while it is streaming.
3. Stay away from bottom while text continues to stream.

Expected:

- User remains at the older reading position.
- Latest chip appears.
- Streaming row can grow without forcing the viewport down.
- Clicking Latest returns to streaming row.

### 10.3 Anchor restore during row height changes

Steps:

1. Scroll to a row above a large markdown/code block.
2. Expand/collapse any available collapsible content nearby.
3. Resize the window narrower/wider.

Expected:

- The row being read stays roughly in place.
- Height changes above the viewport are compensated.
- No sudden jump to top/bottom.

## 11. Lifecycle hardening regression tests

These are the most important correctness checks.

### 11.1 Fast final-answer race

Goal: make sure a final answer cannot complete before `startTurn` returns and then get rewound to running.

Manual approximation:

1. Use a very short prompt likely to complete immediately: `ok`.
2. Repeat 10 times in fresh and existing conversations.
3. Watch final status after each turn.

Expected:

- Completed turn remains completed.
- No admitted request remains visually running.
- No active work remains after completion.

Failure signs:

- Turn shows completed then returns to running.
- Dock shows active work after final answer.
- Queue/admitted request status stays admitted/running after terminal turn.

### 11.2 Late runtime start response

Manual approximation:

1. Send a short prompt under slow/network-stressed conditions if possible.
2. Interrupt or complete quickly.
3. Watch whether provider turn mapping creates a new active turn after terminal state.

Expected:

- Late `/runtime/turn/start` result is ignored if pending turn was cleared.
- Provider turn id is not mapped after terminal completion.
- No new active work appears.

### 11.3 Late assistant delta after terminal turn

Manual approximation:

1. Start a streaming response.
2. Interrupt mid-stream.
3. Watch for 10 seconds.

Expected:

- No new text appends after interruption is accepted.
- Message does not return to streaming state.
- Turn remains canceled/interrupted.

### 11.4 Failed turn cannot overwrite completed turn

Manual approximation:

1. Trigger a short successful prompt.
2. Immediately trigger provider/runtime error conditions if possible, or inspect event log after rapid conversation switching.

Expected:

- If completion won the transition, later failure event is ignored.
- Message stays completed.
- Conversation does not flip to failed after a successful final answer.

### 11.5 Admitted request terminal projection

Steps:

1. Send a prompt and wait for completion.
2. Inspect any debug DB/state view if available, or rely on UI state.
3. Interrupt another prompt.
4. Trigger a failed prompt if possible.

Expected:

- Completed turn projects admitted request to completed.
- Interrupted turn projects admitted request to canceled.
- Failed turn projects admitted request to failed.
- Already-terminal admitted request is not overwritten.

## 12. Renderer reconciliation guard

Goal: stale DB hydration should not rewind newer live SSE state.

Steps:

1. Open a conversation.
2. Start a response.
3. While response streams, switch away to another conversation and back.
4. Repeat during streaming and immediately after completion.

Expected:

- Live streamed content is not replaced by older DB content.
- Completed rows do not revert to partial text.
- Pending request/approval state does not reappear after it was resolved.

Failure signs:

- Assistant text shrinks after switching back.
- Completed status reverts to streaming.
- Old approval card returns.

## 13. Phase 5: timeline search

### 13.1 Open and close search

Steps:

1. Open a conversation with several rows.
2. Press Cmd+F on macOS or Ctrl+F on Windows/Linux.
3. Type a keyword that exists in an older message.
4. Press Escape.

Expected:

- Timeline search panel opens inside the app.
- Input is focused automatically.
- Match count appears.
- Escape closes and clears search.

Failure signs:

- Browser/native find UI opens instead of app search in Electron.
- Search opens but input is not focused.
- Escape closes the whole app/dialog unexpectedly.

### 13.2 Search next/previous

Steps:

1. Search for a keyword with multiple matches.
2. Press Enter repeatedly.
3. Press Shift+Enter repeatedly.
4. Use next/previous arrow buttons.

Expected:

- Enter jumps to next match.
- Shift+Enter jumps to previous match.
- Buttons match keyboard behavior.
- Match counter updates.
- Target row is temporarily highlighted.
- Search jump does not mark the user as following latest.

Failure signs:

- Match counter gets stuck.
- Search jumps to wrong row.
- Search jump causes streaming updates to pull viewport to bottom.
- Highlight appears on wrong row.

### 13.3 Search no-results state

Steps:

1. Search for a random string that does not exist.

Expected:

- Counter shows `0/0`.
- Next/previous buttons are disabled.
- No scroll jump occurs.

### 13.4 Search indexed content

Search for content from each row type:

- user message text;
- assistant message text;
- tool/raw text where visible;
- activity group title/summary;
- app action title/description/status;
- media item label/path;
- event title/text.

Expected:

- Search finds the row if the text is part of the timeline model.
- Search does not need hidden DOM to work.

## 14. Phase 5: landmark/minimap rail

### 14.1 Rail visibility

Steps:

1. Open a conversation with several user turns.
2. Look at the right side of the timeline.

Expected:

- Compact landmark rail appears when there are landmarks.
- Rail does not cover message content in a destructive way.
- Rail is hidden when there are no rows/landmarks.

### 14.2 Rail expansion

Steps:

1. Hover over the rail.
2. Keyboard focus the rail if possible.

Expected:

- Rail expands into an overlay list.
- Overlay shows readable labels/previews.
- Active/near-current landmark is visually selected.
- Overlay closes on pointer leave/focus leaving.

### 14.3 Landmark click

Steps:

1. Click an older landmark.
2. Click a newer landmark.
3. Click the last landmark.

Expected:

- Timeline jumps to selected row.
- Row highlights briefly.
- Latest chip appears if not at bottom.
- Clicking the last/bottom landmark should behave naturally with bottom state.

Failure signs:

- Click does nothing.
- Click jumps to nearby but wrong row.
- View immediately snaps back to bottom because streaming is active.

### 14.4 Long conversation sampling

Steps:

1. Open a long conversation with more than 120 user/operational landmarks.
2. Inspect compact rail.

Expected:

- Rail samples markers instead of rendering thousands of dots.
- First and last landmarks are preserved.
- Overlay remains usable and scrollable.

## 15. Phase 5: scroll persistence per conversation

### 15.1 Restore unpinned position

Steps:

1. Open conversation A.
2. Scroll to a middle/older row.
3. Open conversation B.
4. Return to conversation A.

Expected:

- Conversation A restores near the previous reading position.
- Latest chip appears if A is restored away from bottom.
- Conversation B has its own independent scroll state.

### 15.2 Restore bottom-follow state

Steps:

1. Open conversation A.
2. Click Latest or scroll to bottom.
3. Open conversation B.
4. Return to conversation A.

Expected:

- Conversation A returns to bottom/latest, not a stale older offset.
- New streaming output follows bottom.

### 15.3 Search/minimap jump persistence

Steps:

1. Use search or minimap to jump to an older row in conversation A.
2. Open conversation B.
3. Return to conversation A.

Expected:

- The programmatic jump position is restored.
- The app does not treat that position as bottom-follow intent.

Failure signs:

- Returning to A always jumps to bottom.
- Returning to A restores B's scroll position.
- Search/minimap jump causes future streaming output to yank to latest.

## 16. Cross-feature stress flows

### 16.1 Queue + search

Steps:

1. Start a long-running turn.
2. Queue another prompt.
3. Search for an older row while the first turn streams.
4. Let the first turn complete.

Expected:

- Search position remains stable.
- Queue state remains visible in dock.
- Queued item does not disappear.
- First turn completion does not yank viewport unless following latest.

### 16.2 Approval + minimap

Steps:

1. Trigger approval.
2. Use minimap to jump to an older user message.
3. Accept/decline approval from lower dock.

Expected:

- Approval dock remains accessible.
- Minimap jump does not lose approval state.
- Approval resolution updates request row/dock correctly.

### 16.3 Interrupt + scroll restore

Steps:

1. Start a long response.
2. Scroll away from bottom.
3. Interrupt the response.
4. Switch conversations and return.

Expected:

- Interrupted state persists.
- No late deltas append.
- Scroll position restores near where you were reading.

## 17. Accessibility and keyboard checks

Run these quick checks:

- Cmd/Ctrl+F opens search.
- Escape closes search.
- Enter/Shift+Enter navigates matches.
- Latest button is keyboard focusable only when visible.
- Minimap overlay buttons are actual buttons.
- Search input has a useful placeholder.
- Landmark overlay has a listbox role.
- Approval buttons are reachable by keyboard.
- Stop button is reachable while streaming.

## 18. Visual checks

Inspect in both light and dark theme if available:

- message row spacing;
- code block readability;
- lower dock contrast;
- queue item density;
- approval card prominence;
- latest chip placement;
- search panel placement;
- minimap rail not covering important content;
- row highlight subtle but visible;
- long media/action rows do not overflow.

## 19. Automated checks to run before final sign-off

Minimum:

```bash
pnpm --filter @repo/experimental-desktop type-check
pnpm --filter @repo/experimental-desktop test
pnpm --filter @repo/experimental-desktop build
```

Focused checks already relevant to this work:

```bash
pnpm run test -- repository.test.ts
pnpm run test -- useConversationSessionController.test.tsx
pnpm run test -- conversationTimelineModel.test.ts
pnpm run test -- conversationTimelineScroll.test.ts
pnpm run test -- conversationTimelineNavigation.test.ts
pnpm run test -- ComposerPrimaryButton.test.ts
pnpm run test -- ComposerRegion.test.tsx
```

Optional formatting/linting:

```bash
pnpm exec biome check apps/experimental-desktop
```

Note: if Biome already has existing unrelated failures, record only new failures introduced by this branch.

## 20. Final sign-off checklist

Use this as the final checklist before merging or calling the phase complete.

- [ ] Type-check passes.
- [ ] Full test suite passes.
- [ ] Production build passes.
- [ ] Basic send/follow-up flow works.
- [ ] Stop/interruption works and does not rewind.
- [ ] Queue add/remove/pause/resume works.
- [ ] Approval accept/decline/cancel works.
- [ ] Long user messages collapse/expand correctly.
- [ ] Markdown/code rendering is readable.
- [ ] Copy actions work.
- [ ] Long virtualized conversations scroll without holes/overlap.
- [ ] Streaming while unpinned does not yank the user to bottom.
- [ ] Latest chip appears/hides correctly.
- [ ] Search opens with Cmd/Ctrl+F.
- [ ] Search next/previous works.
- [ ] Search no-results state is sane.
- [ ] Minimap rail appears and expands.
- [ ] Minimap click jumps to correct row.
- [ ] Scroll position restores per conversation.
- [ ] Search/minimap jumps do not become bottom-follow intent.
- [ ] Terminal turns never return to running/streaming.
- [ ] Admitted request terminal projection is correct.
- [ ] No stale approval/request reappears after completion/cancel/failure.
- [ ] No visual regressions in light/dark theme.

## 21. Known current status

As of this document creation:

- Phase 0 through Phase 4 and lifecycle hardening have been committed in `ee527729`.
- Phase 5 search/minimap/scroll persistence is currently under review and not yet committed.
- Phase 5 has passed type-check and focused tests in the coding session.
- Production build still needs to be rerun successfully after Phase 5 review because the build command was blocked by the tool filter during implementation.

## 22. Recommended review order

For fastest review, do this order:

1. Review Phase 5 diff for architecture and UI placement.
2. Run type-check.
3. Run focused timeline/navigation tests.
4. Run production build locally.
5. Smoke test basic send/follow-up.
6. Test search/minimap/scroll restore.
7. Test queue/approval/interrupt regressions.
8. Test long conversation virtualization.
9. Only then commit Phase 5.
