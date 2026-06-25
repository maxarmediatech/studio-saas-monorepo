import {
	IconActivity,
	IconAlertTriangle,
	IconApps,
	IconPhoto,
} from "@tabler/icons-react";
import type { ConversationTimelineRow } from "../../conversations/conversationTimelineModel";
import { cn } from "../../lib/utils";

type ActivityGroupRow = Extract<ConversationTimelineRow, { kind: "activityGroup" }>;
type AppActionRow = Extract<ConversationTimelineRow, { kind: "appAction" }>;
type MediaGridRow = Extract<ConversationTimelineRow, { kind: "mediaGrid" }>;

export function ActivityGroupTimelineRow(props: { row: ActivityGroupRow }) {
	return (
		<article
			data-timeline-row={props.row.semanticKind}
			data-timeline-anchor={props.row.anchorId}
			data-timeline-size={props.row.sizeHint}
			className="mx-auto w-full max-w-[760px] rounded-lg border border-border bg-background/35 px-3 py-2.5"
		>
			<div className="flex items-start gap-2">
				<IconActivity className="mt-0.5 size-4 shrink-0 text-[var(--desktop-subtle)]" />
				<div className="min-w-0">
					<p className="m-0 text-[13px] font-semibold text-[var(--desktop-strong)]">
						{props.row.title}
					</p>
					<p className="m-0 text-[12px] leading-5 text-[var(--desktop-subtle)]">
						{props.row.summary}
					</p>
					{props.row.items.length > 0 ? (
						<ul className="m-0 mt-1 list-disc pl-4 text-[12px] text-[var(--desktop-subtle)]">
							{props.row.items.map((item) => (
								<li key={item}>{item}</li>
							))}
						</ul>
					) : null}
				</div>
			</div>
		</article>
	);
}

export function AppActionTimelineRow(props: { row: AppActionRow }) {
	return (
		<article
			data-timeline-row={props.row.semanticKind}
			data-timeline-anchor={props.row.anchorId}
			data-timeline-size={props.row.sizeHint}
			className="mx-auto w-full max-w-[760px] rounded-lg border border-border bg-[var(--desktop-soft)] px-3 py-2.5"
		>
			<div className="flex items-start justify-between gap-3">
				<div className="min-w-0">
					<div className="mb-1 flex items-center gap-1.5 text-[13px] font-semibold text-[var(--desktop-strong)]">
						<IconApps className="size-4" />
						{props.row.title}
					</div>
					{props.row.description ? (
						<p className="m-0 whitespace-pre-wrap break-words text-[12px] leading-5 text-[var(--desktop-subtle)]">
							{props.row.description}
						</p>
					) : null}
				</div>
				<ActionStatus status={props.row.status} />
			</div>
		</article>
	);
}

export function MediaGridTimelineRow(props: { row: MediaGridRow }) {
	return (
		<article
			data-timeline-row={props.row.semanticKind}
			data-timeline-anchor={props.row.anchorId}
			data-timeline-size={props.row.sizeHint}
			className="mx-auto w-full max-w-[820px] rounded-lg border border-border bg-background/35 px-3 py-2.5"
		>
			<div className="mb-2 flex items-center gap-1.5 text-[13px] font-semibold text-[var(--desktop-strong)]">
				<IconPhoto className="size-4" />
				{props.row.title}
			</div>
			<div className="grid grid-cols-2 gap-2 md:grid-cols-3">
				{props.row.items.map((item) => (
					<div
						key={item.id}
						className="min-w-0 rounded-[12px] border border-border bg-[var(--desktop-soft)] p-2"
					>
						<div className="flex aspect-[4/3] items-center justify-center rounded-[10px] bg-background/60 text-[var(--desktop-subtle)]">
							<IconPhoto className="size-5" />
						</div>
						<p className="m-0 mt-1 truncate text-[12px] font-medium text-[var(--desktop-strong)]">
							{item.label}
						</p>
						{item.path ? (
							<p className="m-0 truncate font-mono text-[10px] text-[var(--desktop-subtle)]">
								{item.path}
							</p>
						) : null}
					</div>
				))}
			</div>
		</article>
	);
}

function ActionStatus(props: { status: AppActionRow["status"] }) {
	return (
		<span
			className={cn(
				"inline-flex shrink-0 items-center rounded-full border px-2 py-1 text-[11px] font-medium capitalize",
				props.status === "failed"
					? "border-destructive/30 bg-destructive/10 text-destructive"
					: "border-border bg-background/45 text-[var(--desktop-subtle)]",
			)}
		>
			{props.status === "failed" ? (
				<IconAlertTriangle className="mr-1 size-3" />
			) : null}
			{props.status}
		</span>
	);
}
