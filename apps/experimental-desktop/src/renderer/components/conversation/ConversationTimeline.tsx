import type { ConversationTimelineRow as TimelineRowData } from "../../conversations/conversationTimelineModel";
import { ScrollArea } from "../ui/scroll-area";
import { TimelineRow } from "./TimelineRow";

export function ConversationTimeline(props: { rows: TimelineRowData[] }) {
	return (
		<ScrollArea className="h-full min-h-0">
			<div className="mx-auto flex min-h-full w-full max-w-[980px] flex-col gap-3 px-2 py-4">
				{props.rows.map((row) => (
					<TimelineRow key={row.id} row={row} />
				))}
			</div>
		</ScrollArea>
	);
}
