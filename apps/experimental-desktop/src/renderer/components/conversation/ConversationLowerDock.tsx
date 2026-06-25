import {
	IconActivity,
	IconChecks,
	IconListDetails,
	IconPlayerPause,
	IconPlayerPlay,
	IconPlayerStop,
	IconTrash,
} from "@tabler/icons-react";
import { useEffect, useMemo, useState } from "react";
import type { PendingRequest } from "../../app/types";
import type { ConversationTimelineRow } from "../../conversations/conversationTimelineModel";
import type { ComposerQueueState } from "../composer/core/composerQueueStore";
import { cn } from "../../lib/utils";
import { Button } from "../ui/button";
import { formatDurationSince } from "./timelineText";

type AssistantRow = Extract<ConversationTimelineRow, { kind: "message" }>;

type PendingDecision = "accept" | "acceptForSession" | "decline" | "cancel";

export function ConversationLowerDock(props: {
	rows: ConversationTimelineRow[];
	pendingRequests: PendingRequest[];
	isTurnActive: boolean;
	onRespond: (requestId: string, decision: PendingDecision) => Promise<void>;
	queueState: ComposerQueueState;
	onPauseQueue: () => void;
	onResumeQueue: () => void;
	onRemoveQueuedRequest: (queueItemId: string) => Promise<void>;
}) {
	const activeAssistant = useMemo(
		() => findActiveAssistant(props.rows),
		[props.rows],
	);
	const showActiveWork = props.isTurnActive || Boolean(activeAssistant);
	const showQueue =
		props.queueState.items.length > 0 || Boolean(props.queueState.lastError);

	if (!showActiveWork && props.pendingRequests.length === 0 && !showQueue) {
		return null;
	}

	return (
		<section className="px-2 py-3" aria-label="Conversation operations">
			<div className="mx-auto grid w-full max-w-[980px] gap-2 lg:grid-cols-[minmax(0,1fr)_minmax(280px,360px)]">
				{showQueue ? (
					<QueuePanel
						state={props.queueState}
						onPause={props.onPauseQueue}
						onResume={props.onResumeQueue}
						onRemove={props.onRemoveQueuedRequest}
					/>
				) : null}
				{showActiveWork ? (
					<ActiveWorkPanel
						assistant={activeAssistant}
						isTurnActive={props.isTurnActive}
					/>
				) : null}
				{props.pendingRequests.length > 0 ? (
					<PendingApprovalPanel
						requests={props.pendingRequests}
						onRespond={props.onRespond}
					/>
				) : null}
			</div>
		</section>
	);
}

function QueuePanel(props: {
	state: ComposerQueueState;
	onPause: () => void;
	onResume: () => void;
	onRemove: (queueItemId: string) => Promise<void>;
}) {
	return (
		<article className="rounded-[16px] border border-border bg-[var(--desktop-panel)] px-3 py-2.5 shadow-sm backdrop-blur">
			<div className="mb-2 flex items-start justify-between gap-3">
				<div className="min-w-0">
					<div className="flex items-center gap-1.5 text-[12px] font-semibold text-[var(--desktop-strong)]">
						<IconListDetails className="size-3.5" />
						Queue
					</div>
					<p className="m-0 text-[11px] text-[var(--desktop-subtle)]">
						{props.state.items.length} waiting{props.state.isPaused ? " · paused" : ""}
					</p>
				</div>
				<Button
					size="xs"
					variant="outline"
					type="button"
					onClick={props.state.isPaused ? props.onResume : props.onPause}
				>
					{props.state.isPaused ? (
						<IconPlayerPlay className="mr-1 size-3" />
					) : (
						<IconPlayerPause className="mr-1 size-3" />
					)}
					{props.state.isPaused ? "Resume" : "Pause"}
				</Button>
			</div>
			{props.state.lastError ? (
				<div className="mb-2 rounded-[10px] border border-destructive/30 bg-destructive/10 px-2.5 py-2 text-[12px] text-destructive">
					{props.state.lastError}
				</div>
			) : null}
			<div className="flex flex-col gap-1.5">
				{props.state.items.map((item) => (
					<div
						key={item.queueItemId}
						className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-[12px] border border-border bg-background/45 px-2.5 py-2"
					>
						<div className="min-w-0">
							<p className="m-0 truncate text-[12px] font-medium text-[var(--desktop-strong)]">
								{item.request.providerInput.prompt}
							</p>
							<p className="m-0 text-[11px] capitalize text-[var(--desktop-subtle)]">
								{item.status}{item.error ? ` · ${item.error}` : ""}
							</p>
						</div>
						<Button
							size="xs"
							variant="ghost"
							type="button"
							disabled={item.status === "running"}
							onClick={() => void props.onRemove(item.queueItemId)}
						>
							<IconTrash className="size-3.5" />
						</Button>
					</div>
				))}
			</div>
		</article>
	);
}

function ActiveWorkPanel(props: {
	assistant?: AssistantRow;
	isTurnActive: boolean;
}) {
	const [now, setNow] = useState(Date.now());
	useEffect(() => {
		if (!props.isTurnActive || !props.assistant?.startedAt) {
			return;
		}
		const timer = window.setInterval(() => setNow(Date.now()), 1000);
		return () => window.clearInterval(timer);
	}, [props.assistant?.startedAt, props.isTurnActive]);

	const status = props.isTurnActive ? "Running" : "Settling";
	const duration = props.assistant?.startedAt
		? formatDurationSince(props.assistant.startedAt, now)
		: undefined;
	const preview = props.assistant?.text.trim() || "Waiting for provider activity";

	return (
		<article className="rounded-[16px] border border-border bg-[var(--desktop-panel)] px-3 py-2.5 shadow-sm backdrop-blur">
			<div className="flex items-start justify-between gap-3">
				<div className="min-w-0">
					<div className="flex items-center gap-1.5 text-[12px] font-semibold text-[var(--desktop-strong)]">
						<IconActivity className="size-3.5" />
						Active work
					</div>
					<p className="m-0 mt-1 line-clamp-2 text-[12px] leading-5 text-[var(--desktop-subtle)]">
						{preview}
					</p>
				</div>
				<StatusPill active={props.isTurnActive} label={duration ? `${status} · ${duration}` : status} />
			</div>
		</article>
	);
}

function PendingApprovalPanel(props: {
	requests: PendingRequest[];
	onRespond: (requestId: string, decision: PendingDecision) => Promise<void>;
}) {
	return (
		<article className="rounded-[16px] border border-border bg-[var(--desktop-panel)] px-3 py-2.5 shadow-sm backdrop-blur">
			<div className="mb-2 flex items-center justify-between gap-3">
				<div className="min-w-0">
					<div className="flex items-center gap-1.5 text-[12px] font-semibold text-[var(--desktop-strong)]">
						<IconChecks className="size-3.5" />
						Needs approval
					</div>
					<p className="m-0 text-[11px] text-[var(--desktop-subtle)]">
						{props.requests.length} pending request{props.requests.length === 1 ? "" : "s"}
					</p>
				</div>
				<StatusPill active label="Blocked" />
			</div>
			<div className="flex flex-col gap-2">
				{props.requests.map((request) => (
					<PendingApprovalCard
						key={request.data.requestId}
						request={request}
						onRespond={props.onRespond}
					/>
				))}
			</div>
		</article>
	);
}

function PendingApprovalCard(props: {
	request: PendingRequest;
	onRespond: (requestId: string, decision: PendingDecision) => Promise<void>;
}) {
	const requestId = props.request.data.requestId;
	return (
		<div className="rounded-[12px] border border-border bg-background/45 p-2.5">
			<div className="grid gap-1">
				<div className="flex items-center justify-between gap-2">
					<p className="m-0 text-[12px] font-medium capitalize text-[var(--desktop-strong)]">
						{props.request.data.requestKind} request
					</p>
					<span className="truncate font-mono text-[10px] text-[var(--desktop-subtle)]">
						{requestId}
					</span>
				</div>
				<pre className="m-0 max-h-20 overflow-auto whitespace-pre-wrap break-words text-[11px] text-[var(--desktop-subtle)]">
					{summarizeRequest(props.request.data.raw)}
				</pre>
			</div>
			<div className="mt-2 flex flex-wrap gap-1.5">
				<Button size="xs" type="button" onClick={() => void props.onRespond(requestId, "accept")}>
					Accept once
				</Button>
				<Button
					size="xs"
					variant="secondary"
					type="button"
					onClick={() => void props.onRespond(requestId, "acceptForSession")}
				>
					Accept session
				</Button>
				<Button
					size="xs"
					variant="outline"
					type="button"
					onClick={() => void props.onRespond(requestId, "decline")}
				>
					Decline
				</Button>
				<Button
					size="xs"
					variant="ghost"
					type="button"
					onClick={() => void props.onRespond(requestId, "cancel")}
				>
					Cancel
				</Button>
			</div>
		</div>
	);
}

function StatusPill(props: { label: string; active?: boolean }) {
	return (
		<span
			className={cn(
				"inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-1 text-[11px] font-medium",
				props.active
					? "border-[color-mix(in_srgb,#30d158_24%,var(--desktop-inbox-border))] bg-[color-mix(in_srgb,#30d158_10%,transparent)] text-[color-mix(in_srgb,#30d158_78%,var(--desktop-strong))]"
					: "border-border bg-background/40 text-[var(--desktop-subtle)]",
			)}
		>
			{props.active ? <IconPlayerPlay className="size-3" /> : <IconPlayerStop className="size-3" />}
			{props.label}
		</span>
	);
}

function findActiveAssistant(rows: ConversationTimelineRow[]) {
	for (let index = rows.length - 1; index >= 0; index -= 1) {
		const row = rows[index];
		if (row.kind === "message" && row.role === "assistant") {
			if (row.status === "streaming" || row.status === "pending") {
				return row;
			}
			return undefined;
		}
	}
	return undefined;
}

function summarizeRequest(value: unknown) {
	try {
		return JSON.stringify(value, null, 2).slice(0, 1200);
	} catch {
		return String(value);
	}
}
