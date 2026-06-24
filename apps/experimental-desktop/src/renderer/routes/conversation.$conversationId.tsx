import { useParams } from "@tanstack/react-router";
import { DesktopCompatibilityView } from "../app/DesktopCompatibilityView";
import { DesktopRouteStateView } from "../app/DesktopRouteStateView";
import { useConversationResource } from "../conversations/conversationResourceStore";

export function ConversationRoute() {
	const { conversationId } = useParams({
		from: "/conversation/$conversationId",
	});
	const resource = useConversationResource(conversationId);

	if (resource.status === "loading") {
		return (
			<DesktopRouteStateView
				state={{ kind: "conversation-loading", conversationId }}
			/>
		);
	}

	if (resource.status === "missing") {
		return (
			<DesktopRouteStateView
				state={{
					kind: "conversation-missing",
					conversationId,
					onRetry: resource.retry,
				}}
			/>
		);
	}

	if (resource.status === "error") {
		return (
			<DesktopRouteStateView
				state={{
					kind: "conversation-error",
					conversationId,
					error: resource.error,
					onRetry: resource.retry,
				}}
			/>
		);
	}

	return (
		<DesktopCompatibilityView
			route={{
				kind: "conversation",
				conversationId,
				resource,
			}}
		/>
	);
}
