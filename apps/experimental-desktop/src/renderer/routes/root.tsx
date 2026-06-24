import { useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

export function RootRoute() {
	const navigate = useNavigate();

	useEffect(() => {
		void navigate({
			to: "/draft/$draftId",
			params: { draftId: crypto.randomUUID() },
			replace: true,
		});
	}, [navigate]);

	return null;
}
