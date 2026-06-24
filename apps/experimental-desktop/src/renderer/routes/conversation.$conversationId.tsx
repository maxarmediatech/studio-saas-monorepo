import { useParams } from "@tanstack/react-router";
import { DesktopCompatibilityView } from "../app/DesktopCompatibilityView";
import { useConversationResource } from "../conversations/conversationResourceStore";

export function ConversationRoute() {
	const { conversationId } = useParams({
		from: "/conversation/$conversationId",
	});
	const resource = useConversationResource(conversationId);

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
