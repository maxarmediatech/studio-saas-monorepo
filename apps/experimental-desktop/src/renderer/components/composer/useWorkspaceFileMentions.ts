import { useEffect, useState } from "react";
import type { WorkspaceFileMention } from "../../../preload/types";
import type { ComposerTrigger } from "./composerTriggers";

type SearchableTrigger = Pick<ComposerTrigger, "kind" | "query"> | null;

export function useWorkspaceFileMentions(
	activeTrigger: SearchableTrigger,
	workspaceRoot?: string,
) {
	const [fileResults, setFileResults] = useState<WorkspaceFileMention[]>([]);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState(false);

	useEffect(() => {
		if (activeTrigger?.kind !== "file" || !workspaceRoot) {
			setFileResults([]);
			setLoading(false);
			setError(false);
			return;
		}
		let canceled = false;
		setLoading(true);
		setError(false);
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
					setError(true);
				}
			})
			.finally(() => {
				if (!canceled) {
					setLoading(false);
				}
			});
		return () => {
			canceled = true;
		};
	}, [activeTrigger?.kind, activeTrigger?.query, workspaceRoot]);

	return { results: fileResults, loading, error };
}
