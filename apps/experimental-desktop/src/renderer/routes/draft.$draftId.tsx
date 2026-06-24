import { useParams } from "@tanstack/react-router";
import { DesktopCompatibilityView } from "../app/DesktopCompatibilityView";

export function DraftRoute() {
	const { draftId } = useParams({ from: "/draft/$draftId" });

	return (
		<DesktopCompatibilityView
			route={{
				kind: "draft",
				draftId,
			}}
		/>
	);
}
