import type { ReactNode } from "react";
import type { PendingRequest } from "../../app/types";
import type { ConversationTimelineModel } from "../../conversations/conversationTimelineModel";
import { ConversationStatusBar } from "./ConversationStatusBar";
import { ConversationTimeline } from "./ConversationTimeline";
import { PendingRequestLayer } from "./PendingRequestLayer";

export function ConversationStage(props: {
	status: string;
	threadId?: string;
	model: ConversationTimelineModel;
	composer: ReactNode;
	onRespond: (
		requestId: string,
		decision: "accept" | "acceptForSession" | "decline" | "cancel",
	) => Promise<void>;
}) {
	return (
		<section className="flex min-h-0 w-[min(100%,1080px)] flex-1 flex-col self-center overflow-hidden rounded-lg border border-border bg-[var(--desktop-panel)]">
			<div className="min-h-0 flex-1">
				<ConversationTimeline rows={props.model.rows} />
			</div>
			<PendingRequestLayer
				requests={props.model.pendingRequests}
				onRespond={props.onRespond}
			/>
			<div className="border-t border-border bg-[var(--desktop-soft)]/45 px-3 py-3">
				{props.composer}
			</div>
			<ConversationStatusBar
				status={props.status}
				threadId={props.threadId}
				rowCount={props.model.rows.length}
				pendingCount={props.model.pendingRequests.length}
			/>
		</section>
	);
}

export type ConversationStagePendingRequest = PendingRequest;
