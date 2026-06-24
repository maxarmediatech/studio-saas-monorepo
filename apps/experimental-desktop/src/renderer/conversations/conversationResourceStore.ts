import { useEffect, useState } from "react";
import type { ConversationDetail } from "../../preload/types";
import { loadConversationDetail } from "./conversationTransport";

type ConversationResourceControls = {
	retry: () => void;
};

export type ConversationResourceState =
	| ({
			status: "loading";
			conversationId: string;
	  } & ConversationResourceControls)
	| ({
			status: "ready";
			conversationId: string;
			conversation: ConversationDetail;
	  } & ConversationResourceControls)
	| ({
			status: "missing";
			conversationId: string;
	  } & ConversationResourceControls)
	| ({
			status: "error";
			conversationId: string;
			error: string;
	  } & ConversationResourceControls);

export function useConversationResource(
	conversationId: string,
): ConversationResourceState {
	const [reloadKey, setReloadKey] = useState(0);
	const retry = () => setReloadKey((key) => key + 1);
	const [state, setState] = useState<ConversationResourceState>({
		status: "loading",
		conversationId,
		retry,
	});

	useEffect(() => {
		let canceled = false;
		setState({ status: "loading", conversationId, retry });
		void loadConversationDetail(conversationId)
			.then((conversation) => {
				if (canceled) {
					return;
				}
				if (!conversation) {
					setState({ status: "missing", conversationId, retry });
					return;
				}
				setState({
					status: "ready",
					conversationId,
					conversation,
					retry,
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
					retry,
				});
			});
		return () => {
			canceled = true;
		};
	}, [conversationId, reloadKey]);

	return state;
}
