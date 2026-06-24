import { useParams } from "@tanstack/react-router";
import { DesktopCompatibilityView } from "../app/DesktopCompatibilityView";

export function ConversationRoute() {
	const { conversationId } = useParams({
		from: "/conversation/$conversationId",
	});

	return (
		<DesktopCompatibilityView
			route={{
				kind: "conversation",
				conversationId,
			}}
		/>
	);
}
