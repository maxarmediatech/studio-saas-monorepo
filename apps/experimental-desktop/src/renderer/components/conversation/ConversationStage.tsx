import type { ReactNode } from "react";
import type { PendingRequest } from "../../app/types";
import type { ComposerQueueState } from "../composer/core/composerQueueStore";
import type { ConversationTimelineModel } from "../../conversations/conversationTimelineModel";
import { ConversationLowerDock } from "./ConversationLowerDock";
import { ConversationTimeline } from "./ConversationTimeline";

export function ConversationStage(props: {
	model: ConversationTimelineModel;
	conversationId?: string;
	composer: ReactNode;
	isTurnActive: boolean;
	onRespond: (
		requestId: string,
		decision: "accept" | "acceptForSession" | "decline" | "cancel",
	) => Promise<void>;
	queueState: ComposerQueueState;
	onPauseQueue: () => void;
	onResumeQueue: () => void;
	onRemoveQueuedRequest: (queueItemId: string) => Promise<void>;
}) {
	return (
		<section className="flex min-h-0 w-full flex-1 flex-col overflow-hidden">
			<div className="min-h-0 flex-1">
				<ConversationTimeline
					rows={props.model.rows}
					conversationId={props.conversationId}
				/>
			</div>
			<ConversationLowerDock
				rows={props.model.rows}
				pendingRequests={props.model.pendingRequests}
				isTurnActive={props.isTurnActive}
				onRespond={props.onRespond}
				queueState={props.queueState}
				onPauseQueue={props.onPauseQueue}
				onResumeQueue={props.onResumeQueue}
				onRemoveQueuedRequest={props.onRemoveQueuedRequest}
			/>
			<div className="mx-auto w-full max-w-[980px] pt-4">
				{props.composer}
			</div>
		</section>
	);
}

export type ConversationStagePendingRequest = PendingRequest;
