import { IconAlertTriangle } from "@tabler/icons-react";
import type { ConversationTimelineRow } from "../../conversations/conversationTimelineModel";
import { cn } from "../../lib/utils";

type EventRow = Extract<ConversationTimelineRow, { kind: "event" }>;

export function EventTimelineRow(props: { row: EventRow }) {
	return (
		<article
			data-timeline-row={props.row.semanticKind}
			data-timeline-anchor={props.row.anchorId}
			data-timeline-size={props.row.sizeHint}
			className={cn(
				"mx-auto flex w-full max-w-[760px] gap-2 rounded-lg border px-3 py-2.5 text-[13px]",
				props.row.tone === "error"
					? "border-destructive/30 bg-destructive/10"
					: "border-border bg-background/35",
			)}
		>
			<IconAlertTriangle className="mt-0.5 size-4 shrink-0 text-[var(--desktop-subtle)]" />
			<div className="min-w-0">
				<p className="m-0 font-medium text-[var(--desktop-strong)]">
					{props.row.title}
				</p>
				{props.row.text ? (
					<p className="m-0 whitespace-pre-wrap break-words text-[var(--desktop-subtle)]">
						{props.row.text}
					</p>
				) : null}
			</div>
		</article>
	);
}
