import { useEffect, useRef, useState } from "react";
import type {
	ConversationDetail,
	ConversationEvent,
} from "../../preload/types";
import type { PendingRequest, TranscriptItem } from "../app/types";
import { createConversationEventStore } from "./conversationEventStore";
import { useConversationHistoryStore } from "./conversationHistoryStore";
import {
	applyConversationEventProjection,
	type ConversationProjectionState,
	createEmptyConversationProjection,
	projectConversationDetail,
	summarizeConversationEvent,
} from "./conversationProjection";

export type ConversationRouteState = {
	conversationId?: string;
	threadId?: string;
	status: string;
	transcript: TranscriptItem[];
	eventLog: string[];
	pendingRequests: PendingRequest[];
	isTurnActive: boolean;
	isTurnRunning: boolean;
};

export function useConversationRoute(input: {
	conversation?: ConversationDetail;
}): ConversationRouteState {
	const [threadId, setThreadId] = useState<string>();
	const [eventLog, setEventLog] = useState<string[]>([]);
	const [projection, setProjection] = useState<ConversationProjectionState>(
		createEmptyConversationProjection(),
	);
	const projectionStateRef = useRef<ConversationProjectionState>(
		createEmptyConversationProjection(),
	);
	const eventStoreRef = useRef(createConversationEventStore());
	const history = useConversationHistoryStore();
	const refreshConversationsRef = useRef(history.refreshConversations);

	useEffect(() => {
		refreshConversationsRef.current = history.refreshConversations;
	}, [history.refreshConversations]);

	useEffect(() => {
		const eventStore = eventStoreRef.current;
		eventStore.clear();
		setEventLog([]);

		if (!input.conversation) {
			setThreadId(undefined);
			applyProjectionState(createEmptyConversationProjection());
			return () => eventStore.clear();
		}

		setThreadId(input.conversation.providerThreadId);
		applyProjectionState(projectConversationDetail(input.conversation));
		void eventStore.subscribe(
			input.conversation.id,
			handleConversationEvent,
		);

		return () => eventStore.clear();
	}, [input.conversation]);

	function handleConversationEvent(event: ConversationEvent) {
		appendEventLog(event);
		const result = applyConversationEventProjection(
			projectionStateRef.current,
			event,
		);
		applyProjectionState(result.state);
		if (result.shouldRefreshConversations) {
			void refreshConversationsRef.current();
		}
	}

	function applyProjectionState(state: ConversationProjectionState) {
		projectionStateRef.current = state;
		setProjection(state);
	}

	function appendEventLog(event: ConversationEvent) {
		setEventLog((events) =>
			[
				...events,
				`${new Date(event.time).toLocaleTimeString()} ${event.type} ${summarizeConversationEvent(event)}`,
			].slice(-80),
		);
	}

	return {
		conversationId: input.conversation?.id,
		threadId,
		status: projection.status,
		transcript: projection.transcript,
		eventLog,
		pendingRequests: projection.pendingRequests,
		isTurnActive: projection.isTurnActive,
		isTurnRunning:
			projection.isTurnActive || projection.pendingRequests.length > 0,
	};
}
