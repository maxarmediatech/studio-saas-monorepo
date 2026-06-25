import type { ConversationTimelineRow } from "../../conversations/conversationTimelineModel";
import {
	AssistantMessageRow,
	SystemMessageRow,
	UserMessageRow,
} from "./MessageTimelineRow";
import {
	ActivityGroupTimelineRow,
	AppActionTimelineRow,
	MediaGridTimelineRow,
} from "./OperationalTimelineRows";
import { EventTimelineRow } from "./EventTimelineRow";
import { RequestTimelineRow } from "./RequestTimelineRow";

export function TimelineRow(props: { row: ConversationTimelineRow }) {
	const row = props.row;
	if (row.kind === "request") {
		return <RequestTimelineRow row={row} />;
	}
	if (row.kind === "event") {
		return <EventTimelineRow row={row} />;
	}
	if (row.kind === "activityGroup") {
		return <ActivityGroupTimelineRow row={row} />;
	}
	if (row.kind === "appAction") {
		return <AppActionTimelineRow row={row} />;
	}
	if (row.kind === "mediaGrid") {
		return <MediaGridTimelineRow row={row} />;
	}
	if (row.role === "user") {
		return <UserMessageRow row={row} />;
	}
	if (row.role === "system") {
		return <SystemMessageRow row={row} />;
	}
	return <AssistantMessageRow row={row} />;
}
