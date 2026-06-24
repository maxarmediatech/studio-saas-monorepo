import type { ReactNode } from "react";
import type { PendingRequest } from "../../app/types";
import type { ConversationTimelineModel } from "../../conversations/conversationTimelineModel";
import { ConversationTimeline } from "./ConversationTimeline";
import { PendingRequestLayer } from "./PendingRequestLayer";

export function ConversationStage(props: {
	model: ConversationTimelineModel;
	composer: ReactNode;
	onRespond: (
		requestId: string,
		decision: "accept" | "acceptForSession" | "decline" | "cancel",
	) => Promise<void>;
}) {
	return (
		<section className="flex min-h-0 w-[min(100%,980px)] flex-1 flex-col self-center overflow-hidden">
			<div className="min-h-0 flex-1">
				<ConversationTimeline rows={props.model.rows} />
			</div>
			<PendingRequestLayer
				requests={props.model.pendingRequests}
				onRespond={props.onRespond}
			/>
			<div className="pt-4">
				{props.composer}
			</div>
		</section>
	);
}

export type ConversationStagePendingRequest = PendingRequest;
