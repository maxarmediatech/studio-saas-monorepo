import { useEffect, useState } from "react";
import type { WorkspaceFileMention } from "../../../preload/types";
import type { ComposerTrigger } from "./composerTriggers";

type SearchableTrigger = Pick<ComposerTrigger, "kind" | "query"> | null;

export function useWorkspaceFileMentions(
	activeTrigger: SearchableTrigger,
	workspaceRoot?: string,
) {
	const [fileResults, setFileResults] = useState<WorkspaceFileMention[]>([]);

	useEffect(() => {
		if (activeTrigger?.kind !== "file" || !workspaceRoot) {
			setFileResults([]);
			return;
		}
		let canceled = false;
		void window.experimentalDesktop
			.searchWorkspaceFiles({
				rootPath: workspaceRoot,
				query: activeTrigger.query,
				limit: 24,
			})
			.then((results) => {
				if (!canceled) {
					setFileResults(results);
				}
			})
			.catch(() => {
				if (!canceled) {
					setFileResults([]);
				}
			});
		return () => {
			canceled = true;
		};
	}, [activeTrigger?.kind, activeTrigger?.query, workspaceRoot]);

	return fileResults;
}
