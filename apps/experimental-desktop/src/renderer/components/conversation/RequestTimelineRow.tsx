import type { ConversationTimelineRow } from "../../conversations/conversationTimelineModel";
import { Badge } from "../ui/badge";

type RequestRow = Extract<ConversationTimelineRow, { kind: "request" }>;

export function RequestTimelineRow(props: { row: RequestRow }) {
	return (
		<article
			data-timeline-row={props.row.semanticKind}
			data-timeline-anchor={props.row.anchorId}
			data-timeline-size={props.row.sizeHint}
			className="mx-auto w-full max-w-[760px] rounded-lg border border-border bg-[var(--desktop-selected)] px-3 py-2.5"
		>
			<div className="flex items-center justify-between gap-3">
				<div className="min-w-0">
					<p className="m-0 text-[13px] font-medium text-[var(--desktop-strong)]">
						{props.row.requestKind} approval
					</p>
					<p className="m-0 truncate font-mono text-[11px] text-[var(--desktop-subtle)]">
						{props.row.requestId}
					</p>
				</div>
				<Badge
					variant={props.row.pending ? "default" : "outline"}
					className="rounded-md"
				>
					{props.row.pending ? "pending" : "resolved"}
				</Badge>
			</div>
		</article>
	);
}
