import type { ConversationTimelineRow as TimelineRowData } from "../../conversations/conversationTimelineModel";
import { ScrollArea } from "../ui/scroll-area";
import { TimelineRow } from "./TimelineRow";

export function ConversationTimeline(props: { rows: TimelineRowData[] }) {
	return (
		<ScrollArea className="h-full min-h-0">
			<div className="mx-auto flex min-h-full w-full max-w-[860px] flex-col gap-3 px-4 py-5">
				{props.rows.length === 0 ? (
					<div className="flex min-h-[280px] items-center justify-center text-center text-[13px] text-[var(--desktop-subtle)]">
						Conversation output will appear here.
					</div>
				) : (
					props.rows.map((row) => <TimelineRow key={row.id} row={row} />)
				)}
			</div>
		</ScrollArea>
	);
}
