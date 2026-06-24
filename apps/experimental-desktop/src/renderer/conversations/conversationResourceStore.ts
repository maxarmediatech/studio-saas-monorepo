import { useEffect, useState } from "react";
import type { ConversationDetail } from "../../preload/types";
import { loadConversationDetail } from "./conversationTransport";

export type ConversationResourceState =
	| { status: "loading"; conversationId: string }
	| {
			status: "ready";
			conversationId: string;
			conversation: ConversationDetail;
	  }
	| { status: "missing"; conversationId: string }
	| { status: "error"; conversationId: string; error: string };

export function useConversationResource(
	conversationId: string,
): ConversationResourceState {
	const [state, setState] = useState<ConversationResourceState>({
		status: "loading",
		conversationId,
	});

	useEffect(() => {
		let canceled = false;
		setState({ status: "loading", conversationId });
		void loadConversationDetail(conversationId)
			.then((conversation) => {
				if (canceled) {
					return;
				}
				if (!conversation) {
					setState({ status: "missing", conversationId });
					return;
				}
				setState({
					status: "ready",
					conversationId,
					conversation,
				});
			})
			.catch((error: unknown) => {
				if (canceled) {
					return;
				}
				setState({
					status: "error",
					conversationId,
					error:
						error instanceof Error ? error.message : String(error),
				});
			});
		return () => {
			canceled = true;
		};
	}, [conversationId]);

	return state;
}
