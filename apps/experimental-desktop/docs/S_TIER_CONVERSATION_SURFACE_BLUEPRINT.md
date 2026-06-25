# S-Tier Conversation Surface Blueprint

Created: 2026-06-24
Target: experimental desktop conversation surface

## Executive call

The best version for our app is not a normal chat UI. It should be a media-aware operational timeline: conversation, tools, files, images, approvals, queue, tasks, plans, app actions, clients, shoots, invoices, and deliverables in one trustworthy work surface.

The references solve different parts:

- Traycer: strongest scroll system, virtualized chat, minimap, lower dock, queue, active agents, and resize performance.
- OpenCode: strongest session timeline architecture, anchored virtualizer, progress bar, hash jumps, and grouped operational rows.
- T3Code: strongest compact polish around copy, collapse, composer banners, pending panels, and hover metadata.
- AionUI: strongest native desktop feel, image preview groups, sendbox states, thinking rows, tool groups, and command queue shape.

The S-tier direction is: Traycer and OpenCode for architecture; T3Code and AionUI for interaction polish; then adapt everything to our studio workflow.

## North star

The conversation surface should answer five questions at all times:

1. What did I ask?
2. What is the assistant doing?
3. What changed in my app or workspace?
4. What needs my action?
5. Where am I in this long session?

That means the app should not only render messages. It should render an operational history with live controls.

## Principles

### Timeline is the product

The composer is a command bar. The timeline is where trust is built. It should show work, group noisy events, expose approvals, show app actions, show files and media, preserve navigation, and let the user recover from failures.

### Stop is not a send mode

Stop must be visible while work is running. Queue and send can be separate. The current primary action pattern can hide Stop behind Queue. That is not acceptable for an S-tier app.

### Scroll is a state machine

A serious agent timeline cannot use a simple effect that scrolls to bottom when rows change. Streaming, image loading, markdown expansion, tool collapse, history loading, and hidden tabs all break that pattern.

The right model is:

```txt
row mutation -> scroll policy -> list adapter
user gesture -> follow intent
hidden surface -> restore anchor
measured row change -> preserve viewport
```

### Rows must be semantic

Raw provider parts should not leak into the UI as generic JSON cards. The model should expose product concepts: user message, assistant turn, working row, activity group, tool call, file changes, media grid, approval, queue event, app action, plan, todo, error, compaction, and system notice.

### Lower dock owns live operational state

A lower dock above the composer should hold queue, pending approvals, active work, pinned plan, pinned tasks, accumulated changes, and current context. The timeline remains readable; the dock keeps current controls close to the composer.

## Target component tree

```txt
ConversationShell
  ConversationHeader
  ConversationProgressBar
  ConversationStage
    ConversationTimelineViewport
      ConversationVirtualList
        TimelineRowRouter
          UserMessageRow
          AssistantTurnRow
          WorkingRow
          ActivityGroupRow
          ToolCallRow
          FileChangeSummaryRow
          MediaGridRow
          ApprovalRow
          QueueEventRow
          AppActionRow
          ErrorRow
          CompactionRow
      ConversationMinimap
      ScrollToLatestChip
    ConversationLowerDock
      ActiveWorkPanel
      PendingApprovalPanel
      QueuePanel
      PinnedPlanPanel
      PinnedTasksPanel
      AccumulatedChangesPanel
      CurrentContextPanel
    ComposerRegion
      ComposerBannerStack
      SessionComposer
      ComposerActionCluster
```

The important split is not visual. It is responsibility:

- Timeline rows are durable history.
- Lower dock is live action state.
- Composer is command input.
- Scroll controller owns navigation and trust.

## Target row model

```ts
export type TimelineRow =
	| UserMessageRow
	| AssistantTurnRow
	| WorkingRow
	| ActivityGroupRow
	| ToolCallRow
	| FileChangeSummaryRow
	| MediaGridRow
	| ApprovalRow
	| QueueEventRow
	| AppActionRow
	| ErrorRow
	| CompactionRow
	| SystemNoticeRow;

export interface TimelineRowBase {
	readonly id: string;
	readonly kind: TimelineRowKind;
	readonly createdAt: string;
	readonly turnId: string | null;
	readonly anchorId: string;
	readonly signature: string;
	readonly sizeHint: TimelineRowSizeHint;
}

export type TimelineRowKind =
	| "user_message"
	| "assistant_turn"
	| "working"
	| "activity_group"
	| "tool_call"
	| "file_change_summary"
	| "media_grid"
	| "approval"
	| "queue_event"
	| "app_action"
	| "error"
	| "compaction"
	| "system_notice";

export type TimelineRowSizeHint =
	| "compact"
	| "message"
	| "assistant"
	| "tool"
	| "media"
	| "large";
```

The `signature` field matters because unchanged rows should keep object identity. This is what lets memoized rows and virtual lists stay fast during streaming.

## User message row

User messages should be right-aligned, editable, copyable, and collapsible. They should also render attachments and context chips as real UI, not only paths.

```ts
export interface UserMessageRow extends TimelineRowBase {
	readonly kind: "user_message";
	readonly author: HumanAuthor | AgentAuthor;
	readonly content: ComposerContentSnapshot;
	readonly textPreview: string;
	readonly attachments: ReadonlyArray<TimelineAttachment>;
	readonly contextChips: ReadonlyArray<TimelineContextChip>;
	readonly editState: UserMessageEditState;
	readonly steerBadge: TimelineSteerBadge | null;
}

export interface HumanAuthor {
	readonly kind: "human";
	readonly label: "You";
}

export interface AgentAuthor {
	readonly kind: "agent";
	readonly agentId: string;
	readonly label: string;
	readonly expectsReply: boolean;
}
```

Traycer has an important lesson here: `role: user` does not always mean the human user. Future multi-agent studio flows may include messages from an editor agent, scheduler agent, finance agent, or gallery agent. Those should render as operational cards, not as human-authored prompts.

### User message component example

```tsx
const USER_MESSAGE_MAX_HEIGHT = 300;

export function UserMessageRow(props: { readonly row: UserMessageRow }) {
	if (props.row.author.kind === "agent") {
		return <AgentToAgentMessageRow row={props.row} />;
	}

	return (
		<article
			data-timeline-row="user-message"
			className="group/user-row flex w-full justify-end px-3 py-2 [overflow-anchor:none]"
		>
			<div className="flex min-w-0 max-w-[min(85%,46rem)] flex-col items-end gap-1.5">
				<AttachmentStrip attachments={props.row.attachments} align="end" />
				<UserMessageBubble row={props.row} />
			</div>
		</article>
	);
}

function UserMessageBubble(props: { readonly row: UserMessageRow }) {
	const contentRef = useRef<HTMLDivElement | null>(null);
	const [overflowing, setOverflowing] = useState(false);
	const [expanded, setExpanded] = useState(false);

	useLayoutEffect(() => {
		const element = contentRef.current;
		if (!element) return;
		const update = () => setOverflowing(element.scrollHeight > USER_MESSAGE_MAX_HEIGHT);
		const observer = new ResizeObserver(update);
		observer.observe(element);
		update();
		return () => observer.disconnect();
	}, []);

	const clamped = overflowing && !expanded;

	return (
		<div className="relative min-w-0 max-w-full">
			<div className="rounded-xl border border-border bg-[var(--desktop-selected)] px-4 py-3 text-sm leading-6 text-[var(--desktop-strong)] shadow-sm">
				<div
					ref={contentRef}
					style={clamped ? { maxHeight: USER_MESSAGE_MAX_HEIGHT } : undefined}
					className={cn(
						"min-w-0 [overflow-wrap:anywhere]",
						clamped && "overflow-hidden [mask-image:linear-gradient(to_bottom,black_calc(100%-4rem),transparent)]",
					)}
				>
					<ComposerContentRenderer content={props.row.content} />
				</div>
				{overflowing ? (
					<button
						type="button"
						data-scroll-anchor-ignore="true"
						onClick={() => setExpanded((value) => !value)}
						className="mt-2 text-xs font-medium text-muted-foreground hover:text-foreground"
					>
						{expanded ? "Show less" : "Show full message"}
					</button>
				) : null}
			</div>
			<UserMessageActionChip row={props.row} />
		</div>
	);
}
```

## Assistant turn row

Assistant rows should not be one markdown blob. They should contain answer segments, activity groups, artifacts, elapsed metadata, provider metadata, and row actions.

```ts
export interface AssistantTurnRow extends TimelineRowBase {
	readonly kind: "assistant_turn";
	readonly status: "pending" | "streaming" | "completed" | "failed" | "interrupted";
	readonly provider: ProviderRunMeta | null;
	readonly answer: ReadonlyArray<AssistantAnswerSegment>;
	readonly activity: ReadonlyArray<TimelineActivitySegment>;
	readonly artifacts: ReadonlyArray<TimelineArtifact>;
	readonly startedAt: string;
	readonly completedAt: string | null;
	readonly pausedDurationMs: number;
	readonly copyText: string;
	readonly actions: AssistantTurnActions;
}

export interface ProviderRunMeta {
	readonly providerId: string;
	readonly modelId: string;
	readonly reasoningEffort: string | null;
	readonly mode: "normal" | "fast" | "deep" | null;
}
```

The important bit is `copyText`: it should be reply-only text, excluding tools, reasoning, diffs, and raw provider details.

### Assistant component example

```tsx
export function AssistantTurnRow(props: { readonly row: AssistantTurnRow }) {
	const activityTimeline = useMemo(
		() => buildActivityTimeline(props.row.activity, props.row.status),
		[props.row.activity, props.row.status],
	);

	const emptyLiveTurn = props.row.answer.length === 0 && props.row.status !== "completed";

	return (
		<article
			data-timeline-row="assistant-turn"
			className="group/assistant-row w-full px-3 py-2 [contain:layout_paint_style] [contain-intrinsic-size:auto_14rem] [overflow-anchor:none]"
		>
			<div className="mx-auto flex w-full max-w-4xl flex-col gap-2">
				{emptyLiveTurn ? <AssistantRunIndicator row={props.row} /> : null}

				{props.row.answer.map((segment) => (
					<AssistantAnswerSegmentView key={segment.id} segment={segment} />
				))}

				{activityTimeline.map((item) => (
					<ActivityTimelineItemView key={item.id} item={item} />
				))}

				{props.row.status === "streaming" && !emptyLiveTurn ? (
					<AssistantRunIndicator row={props.row} />
				) : null}

				{shouldShowAssistantFooter(props.row) ? (
					<AssistantElapsedFooter row={props.row} />
				) : null}
			</div>
		</article>
	);
}

function shouldShowAssistantFooter(row: AssistantTurnRow) {
	if (row.status !== "completed") return false;
	if (!row.completedAt) return false;
	return row.copyText.trim().length > 0;
}
```

### Assistant footer example

```tsx
function AssistantElapsedFooter(props: { readonly row: AssistantTurnRow }) {
	const elapsedMs = elapsedTurnMs(props.row);
	return (
		<div className="flex items-center gap-1.5 text-xs text-muted-foreground/75">
			<ProviderIcon providerId={props.row.provider?.providerId ?? null} />
			<Tooltip content={<ProviderRunMetaTooltip meta={props.row.provider} />}>
				<span>{formatWorkedFor(elapsedMs)}</span>
			</Tooltip>
			<AssistantCopyButton text={props.row.copyText} />
			{props.row.actions.canFork ? <AssistantForkButton turnId={props.row.id} /> : null}
		</div>
	);
}

function elapsedTurnMs(row: AssistantTurnRow) {
	if (!row.completedAt) return 0;
	return new Date(row.completedAt).getTime() - new Date(row.startedAt).getTime() - row.pausedDurationMs;
}
```

## Segment model

```ts
export type AssistantAnswerSegment =
	| TextSegment
	| ReasoningSegment
	| PlanSegment
	| TodoSegment
	| NextStepsSegment
	| InterviewSegment
	| ArtifactSegment;

export type TimelineActivitySegment =
	| ToolSegment
	| CommandSegment
	| FileChangeSegment
	| ApprovalSegment
	| SubagentSegment
	| AppActionSegment;

export interface TextSegment {
	readonly id: string;
	readonly kind: "text";
	readonly markdown: string;
	readonly streaming: boolean;
}

export interface ReasoningSegment {
	readonly id: string;
	readonly kind: "reasoning";
	readonly title: string;
	readonly summary: string;
	readonly expandedMarkdown: string | null;
	readonly streaming: boolean;
}

export interface AppActionSegment {
	readonly id: string;
	readonly kind: "app_action";
	readonly actionType:
		| "create_client"
		| "create_shoot"
		| "create_invoice"
		| "create_task"
		| "schedule_event"
		| "import_media"
		| "export_file";
	readonly title: string;
	readonly status: "pending" | "running" | "completed" | "failed";
	readonly targetLabel: string | null;
	readonly result: unknown;
}
```

For our app, `AppActionSegment` is more important than raw `ToolSegment`. Users care that a shoot was created, not that an internal mutation ran.

## Stable projection layer

Current projection returns a small `message | request | event` model. S-tier projection should be a semantic compiler:

```txt
raw DB/provider/transcript state -> stable timeline rows -> dumb renderers
```

### Stable cache example

```ts
export function createTimelineStableCache() {
	let previous = new Map<string, TimelineRow>();

	return function stabilize(rows: ReadonlyArray<TimelineRow>) {
		const next = new Map<string, TimelineRow>();
		const stableRows = rows.map((row) => {
			const old = previous.get(row.id);
			const stable = old && old.signature === row.signature ? old : row;
			next.set(row.id, stable);
			return stable;
		});
		previous = next;
		return stableRows;
	};
}
```

### Signature examples

```ts
function userMessageSignature(row: UserMessageRow) {
	return [
		row.kind,
		row.id,
		row.textPreview.length,
		row.attachments.length,
		row.contextChips.length,
		row.editState.status,
		row.steerBadge?.status ?? "none",
	].join(":");
}

function assistantTurnSignature(row: AssistantTurnRow) {
	return [
		row.kind,
		row.id,
		row.status,
		row.answer.map((segment) => segmentSignature(segment)).join("|"),
		row.activity.map((segment) => segmentSignature(segment)).join("|"),
		row.completedAt ?? "live",
	].join(";");
}
```

This avoids full deep comparison while keeping rows stable during streaming.

## Scroll policy engine

A serious timeline needs one pure function that classifies row changes.

```ts
export type TimelineScrollModifier =
	| { readonly type: "none" }
	| { readonly type: "to-bottom"; readonly behavior: ScrollBehavior }
	| { readonly type: "to-row"; readonly rowId: string; readonly align: "start" | "center" | "end"; readonly behavior: ScrollBehavior }
	| { readonly type: "preserve-anchor"; readonly anchorRowId: string; readonly offsetPx: number }
	| { readonly type: "measured-change"; readonly followBottom: boolean };

export interface TimelineScrollPolicy {
	readonly modifier: TimelineScrollModifier;
	readonly bottomFollowIntent: boolean | null;
	readonly reason: TimelineScrollReason;
}

export type TimelineScrollReason =
	| "initial"
	| "submitted-user-message"
	| "queued-message-flushed"
	| "assistant-stream"
	| "append-while-following"
	| "append-while-reading"
	| "branch-reset"
	| "suffix-removed"
	| "measured-row-change"
	| "manual-jump"
	| "none";
```

### Scroll classifier example

```ts
export function classifyTimelineScrollPolicy(input: {
	readonly previousRows: ReadonlyArray<TimelineRow> | null;
	readonly nextRows: ReadonlyArray<TimelineRow>;
	readonly bottomFollowIntent: boolean;
}): TimelineScrollPolicy {
	const { previousRows, nextRows, bottomFollowIntent } = input;

	if (nextRows.length === 0) {
		return { modifier: { type: "none" }, bottomFollowIntent: true, reason: "none" };
	}

	if (previousRows === null || previousRows.length === 0) {
		return { modifier: { type: "to-bottom", behavior: "auto" }, bottomFollowIntent: true, reason: "initial" };
	}

	const submittedUserRow = newestSubmittedUserRow(previousRows, nextRows);
	if (submittedUserRow !== null) {
		return { modifier: { type: "to-bottom", behavior: "smooth" }, bottomFollowIntent: true, reason: "submitted-user-message" };
	}

	const branchAnchor = branchResetAnchor(previousRows, nextRows);
	if (branchAnchor !== null) {
		return {
			modifier: { type: "to-row", rowId: branchAnchor.id, align: "start", behavior: "auto" },
			bottomFollowIntent: true,
			reason: "branch-reset",
		};
	}

	const suffixAnchor = removedSuffixAnchor(previousRows, nextRows);
	if (suffixAnchor !== null) {
		return {
			modifier: bottomFollowIntent
				? { type: "to-bottom", behavior: "auto" }
				: { type: "to-row", rowId: suffixAnchor.id, align: "end", behavior: "auto" },
			bottomFollowIntent: bottomFollowIntent ? true : null,
			reason: "suffix-removed",
		};
	}

	if (isTrailingAssistantStream(previousRows, nextRows)) {
		return {
			modifier: { type: "measured-change", followBottom: bottomFollowIntent },
			bottomFollowIntent: null,
			reason: "assistant-stream",
		};
	}

	if (isAppendOnly(previousRows, nextRows)) {
		return {
			modifier: bottomFollowIntent ? { type: "to-bottom", behavior: "smooth" } : { type: "none" },
			bottomFollowIntent: null,
			reason: bottomFollowIntent ? "append-while-following" : "append-while-reading",
		};
	}

	return { modifier: { type: "none" }, bottomFollowIntent: null, reason: "none" };
}
```

### Scroll helper examples

```ts
function newestSubmittedUserRow(
	previousRows: ReadonlyArray<TimelineRow>,
	nextRows: ReadonlyArray<TimelineRow>,
) {
	const previousIds = new Set(previousRows.map((row) => row.id));
	return nextRows.find((row) => row.kind === "user_message" && !previousIds.has(row.id)) ?? null;
}

function isAppendOnly(previousRows: ReadonlyArray<TimelineRow>, nextRows: ReadonlyArray<TimelineRow>) {
	if (nextRows.length < previousRows.length) return false;
	return previousRows.every((row, index) => nextRows[index]?.id === row.id);
}

function isTrailingAssistantStream(
	previousRows: ReadonlyArray<TimelineRow>,
	nextRows: ReadonlyArray<TimelineRow>,
) {
	if (previousRows.length !== nextRows.length) return false;
	const previousLast = previousRows.at(-1);
	const nextLast = nextRows.at(-1);
	if (!previousLast || !nextLast) return false;
	if (previousLast.id !== nextLast.id) return false;
	if (nextLast.kind !== "assistant_turn") return false;
	return previousLast.signature !== nextLast.signature;
}
```

## Timeline list adapter

Do not hard-couple the app to one virtualizer in every component. Use an adapter.

```ts
export interface TimelineListHandle {
	scrollToBottom: (behavior: ScrollBehavior) => void;
	scrollToRow: (rowId: string, options: TimelineScrollToRowOptions) => void;
	cancelScroll: () => void;
	getViewportElement: () => HTMLElement | null;
}

export interface TimelineListProps {
	readonly rows: ReadonlyArray<TimelineRow>;
	readonly renderRow: (row: TimelineRow) => ReactNode;
	readonly onScrollLocationChange: (location: TimelineScrollLocation) => void;
	readonly onRenderedRowsChange: () => void;
}
```

### Plain adapter first

This can replace the current direct `ScrollArea` plus `.map` pattern before we commit to a virtualizer.

```tsx
export const PlainTimelineList = forwardRef<TimelineListHandle, TimelineListProps>(
	function PlainTimelineList(props, ref) {
		const viewportRef = useRef<HTMLDivElement | null>(null);

		useImperativeHandle(ref, () => ({
			scrollToBottom: (behavior) => {
				const viewport = viewportRef.current;
				viewport?.scrollTo({ top: viewport.scrollHeight, behavior });
			},
			scrollToRow: (rowId, options) => {
				const target = viewportRef.current?.querySelector(`[data-row-id="${rowId}"]`);
				if (target instanceof HTMLElement) {
					target.scrollIntoView({ block: options.align, behavior: options.behavior });
				}
			},
			cancelScroll: () => undefined,
			getViewportElement: () => viewportRef.current,
		}), []);

		return (
			<div
				ref={viewportRef}
				data-conversation-timeline="viewport"
				className="h-full min-h-0 overflow-y-auto overscroll-y-contain"
			>
				<div className="mx-auto flex min-h-full w-full max-w-4xl flex-col gap-3 px-3 py-4">
					{props.rows.map((row) => (
						<div key={row.id} data-row-id={row.id} data-timeline-anchor={row.anchorId}>
							{props.renderRow(row)}
						</div>
					))}
				</div>
			</div>
		);
	},
);
```

Later, create `VirtualTimelineList` with Virtuoso or TanStack Virtual behind the same `TimelineListHandle`.

## S-tier ConversationTimeline

```tsx
export function ConversationTimeline(props: {
	readonly rows: ReadonlyArray<TimelineRow>;
	readonly conversationInstanceId: string;
	readonly minimapItems: ReadonlyArray<TimelineMinimapItem>;
}) {
	const listRef = useRef<TimelineListHandle | null>(null);
	const scroll = useConversationTimelineScrollController({
		rows: props.rows,
		conversationInstanceId: props.conversationInstanceId,
		listRef,
	});

	return (
		<div className="relative min-h-0 flex-1 overflow-hidden">
			<PlainTimelineList
				ref={listRef}
				rows={props.rows}
				renderRow={(row) => <TimelineRowRouter row={row} />}
				onScrollLocationChange={scroll.onScrollLocationChange}
				onRenderedRowsChange={scroll.onRenderedRowsChange}
			/>

			<ConversationMinimap
				items={props.minimapItems}
				activeAnchorId={scroll.activeAnchorId}
				onJump={scroll.jumpToAnchor}
			/>

			<ScrollToLatestChip
				visible={scroll.showScrollToLatest}
				onClick={scroll.jumpToLatest}
			/>
		</div>
	);
}
```

## Scroll-to-latest chip

Use T3Code discoverability with Traycer accessibility details.

```tsx
export function ScrollToLatestChip(props: {
	readonly visible: boolean;
	readonly onClick: () => void;
}) {
	return (
		<button
			type="button"
			tabIndex={props.visible ? 0 : -1}
			aria-label="Jump to latest message"
			onClick={props.onClick}
			className={cn(
				"absolute bottom-4 left-1/2 z-20 -translate-x-1/2",
				"inline-flex items-center gap-1.5 rounded-full border border-border bg-background/90 px-3 py-1.5",
				"text-xs font-medium text-foreground shadow-lg backdrop-blur",
				props.visible ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-1 opacity-0",
			)}
		>
			<IconChevronDown className="size-3.5" />
			<span>Latest</span>
		</button>
	);
}
```

## Conversation minimap

The minimap should show navigation landmarks, not only user prompts. For our app, useful landmarks are user prompts, media drops, app actions, approvals, errors, generated plans, and important decisions.

```ts
export interface TimelineMinimapItem {
	readonly id: string;
	readonly anchorId: string;
	readonly kind: "user" | "plan" | "media" | "approval" | "app_action" | "error";
	readonly title: string;
	readonly preview: string;
	readonly createdAt: string;
}
```

```ts
export function buildTimelineMinimapItems(rows: ReadonlyArray<TimelineRow>) {
	return rows.flatMap((row): TimelineMinimapItem[] => {
		if (row.kind === "user_message") {
			return [{ id: row.id, anchorId: row.anchorId, kind: "user", title: "You", preview: row.textPreview, createdAt: row.createdAt }];
		}
		if (row.kind === "media_grid") {
			return [{ id: row.id, anchorId: row.anchorId, kind: "media", title: row.title, preview: `${row.items.length} media items`, createdAt: row.createdAt }];
		}
		if (row.kind === "app_action") {
			return [{ id: row.id, anchorId: row.anchorId, kind: "app_action", title: row.title, preview: row.subtitle ?? row.status, createdAt: row.createdAt }];
		}
		return [];
	});
}
```

## Activity grouping

Activity groups are the answer to noisy tool streams. The user should see a compact summary first, then expand if needed.

```ts
export interface ActivityGroup {
	readonly id: string;
	readonly segments: ReadonlyArray<TimelineActivitySegment>;
	readonly summary: string;
	readonly active: boolean;
	readonly streaming: boolean;
	readonly startedAt: string | null;
}
```

Studio-friendly summaries should say things like:

```txt
Analyzed 24 images · selected 8 references · created 5 tasks
Imported 412 photos · grouped 6 events · found 14 hero candidates
Created invoice · scheduled shoot · updated client profile
```

## Lower dock

The lower dock is the biggest product win from Traycer. It keeps live operational state near the composer without crowding the durable timeline.

```ts
export interface ConversationLowerDockState {
	readonly activeWork: ActiveWorkPanelState | null;
	readonly approvals: ReadonlyArray<PendingApprovalItem>;
	readonly questions: ReadonlyArray<PendingQuestionItem>;
	readonly queue: ConversationQueueState;
	readonly pinnedPlan: PinnedPlanState | null;
	readonly pinnedTasks: PinnedTasksState | null;
	readonly accumulatedChanges: AccumulatedChangesState | null;
	readonly currentContext: CurrentContextState | null;
}

export interface ConversationQueueState {
	readonly status: "idle" | "running" | "paused" | "failed";
	readonly items: ReadonlyArray<ConversationQueueItem>;
	readonly owner: "user" | "runtime" | "remote";
}
```

```tsx
export function ConversationLowerDock(props: {
	readonly state: ConversationLowerDockState;
	readonly actions: ConversationLowerDockActions;
}) {
	const hasContent =
		props.state.activeWork !== null ||
		props.state.approvals.length > 0 ||
		props.state.questions.length > 0 ||
		props.state.queue.items.length > 0 ||
		props.state.pinnedPlan !== null ||
		props.state.pinnedTasks !== null ||
		props.state.accumulatedChanges !== null ||
		props.state.currentContext !== null;

	if (!hasContent) return null;

	return (
		<div className="bg-[var(--desktop-bg)] px-4 pt-2">
			<div className="mx-auto w-full max-w-4xl">
				<div className="overflow-hidden rounded-t-xl border border-b-0 border-border bg-background/45 shadow-sm">
					<ActiveWorkPanel state={props.state.activeWork} actions={props.actions.activeWork} />
					<PendingApprovalPanel items={props.state.approvals} actions={props.actions.approvals} />
					<QueuePanel state={props.state.queue} actions={props.actions.queue} />
					<PinnedPlanPanel state={props.state.pinnedPlan} actions={props.actions.plan} />
					<PinnedTasksPanel state={props.state.pinnedTasks} actions={props.actions.tasks} />
					<AccumulatedChangesPanel state={props.state.accumulatedChanges} actions={props.actions.changes} />
					<CurrentContextPanel state={props.state.currentContext} actions={props.actions.context} />
				</div>
			</div>
		</div>
	);
}
```

## Composer action cluster

The current composer action should not hide cancellation while a turn is running. Minimum fix: cancellation wins over queue. Better fix: render cancellation as a separate control beside send or queue.

```tsx
export function ComposerActionCluster(props: {
	readonly primaryAction: ComposerPrimaryAction;
	readonly turnActive: boolean;
	readonly cancelPending: boolean;
	readonly onPrimary: () => void;
	readonly onCancelTurn: () => void;
}) {
	return (
		<div className="flex items-center gap-1.5">
			{props.turnActive ? (
				<ComposerCancelTurnButton pending={props.cancelPending} onCancel={props.onCancelTurn} />
			) : null}
			<ComposerPrimaryButton action={props.primaryAction} onClick={props.onPrimary} />
		</div>
	);
}
```

## Media grid row

Image and video references should become visual rows, not path-only cards.

```ts
export interface MediaGridRow extends TimelineRowBase {
	readonly kind: "media_grid";
	readonly title: string;
	readonly items: ReadonlyArray<TimelineMediaItem>;
	readonly layout: "strip" | "grid" | "contact_sheet" | "comparison";
	readonly source: "attachment" | "camera_import" | "reference" | "generated";
}

export interface TimelineMediaItem {
	readonly id: string;
	readonly kind: "image" | "video";
	readonly label: string;
	readonly path: string;
	readonly thumbnailUrl: string | null;
	readonly mimeType: string | null;
	readonly selected: boolean;
}
```

## App action row

For our app, this is more important than raw tool rows. Users should see meaningful actions directly: client created, shoot created, invoice drafted, task created, calendar event scheduled, media imported, file exported.

## CSS and performance rules

Add semantic tokens and scroll primitives before adding more visual variants.

```css
:root {
	--conversation-user-bg: var(--desktop-selected);
	--conversation-card-bg: color-mix(in srgb, var(--desktop-panel) 74%, transparent);
	--conversation-tool-bg: color-mix(in srgb, var(--desktop-soft) 72%, transparent);
	--conversation-error-bg: color-mix(in srgb, var(--destructive) 10%, transparent);
}

[data-conversation-timeline="viewport"] {
	overflow-anchor: none;
	overscroll-behavior-y: contain;
	scrollbar-gutter: stable both-edges;
}

[data-timeline-row] {
	overflow-anchor: none;
}
```

## Testing strategy

Add tests before adding too much visual complexity.

```txt
Scroll policy
  - first non-empty render scrolls to latest
  - user scroll-away prevents streaming auto-follow
  - submitted user message re-pins to latest
  - measured row change preserves reading position

Timeline rows
  - long user messages collapse by measured height
  - assistant copy excludes tool and reasoning segments
  - activity groups summarize noisy tool streams
  - app action rows expose primary and secondary actions

Lower dock
  - hidden when no live state exists
  - queue and active work can appear together
  - pending approval gets priority over passive panels
```

## Implementation phases

### Phase 0 — immediate safety fixes

1. Fix cancellation visibility so Queue cannot hide it.
2. Add initial scroll-to-latest.
3. Add scroll-to-latest chip.
4. Add bottom-follow intent guard.
5. Add timeline scroll CSS primitives.

### Phase 1 — architecture foundation

1. Add semantic timeline row types.
2. Add row signatures and stable projection cache.
3. Split current `TimelineRow` into role and row-specific components.
4. Add timeline list adapter.
5. Add scroll policy classifier tests.

### Phase 2 — timeline quality

1. Add user message collapse and copy.
2. Add assistant elapsed footer and reply-only copy.
3. Add markdown rendering.
4. Add raw details disclosure.
5. Add minimap landmarks.

### Phase 3 — operational surface

1. Add activity groups.
2. Add lower dock shell.
3. Move queue into lower dock.
4. Add pending approval and question panels.
5. Add app action rows.
6. Add media grid rows.

### Phase 4 — performance

1. Swap plain list adapter to virtual list adapter.
2. Add resize performance class.
3. Add row containment and intrinsic-size hints.
4. Add stress fixture with long conversations.
5. Add streaming scroll regression tests.

## Final recommendation

Build the S-tier surface around three primitives:

```txt
TimelineRow       = durable semantic history
ConversationDock  = live actionable operational state
ScrollController  = trust-preserving navigation and streaming behavior
```

Do not start with a giant visual redesign. Start with architecture that makes advanced behavior possible: semantic rows, scroll policy engine, lower dock, split action controls, row memoization, media-aware rendering, and app-action rows.

This is how we get the best of Traycer, OpenCode, T3Code, and AionUI without copying any one app blindly.
