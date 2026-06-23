import { useEffect, useMemo, useState } from "react";
import type { ComposerHistoryEntry, ComposerSavedDraft } from "./composerTypes";

export function useComposerHistory(workspaceRoot?: string) {
	const [history, setHistory] = useState<ComposerHistoryEntry[]>([]);
	const [historyIndex, setHistoryIndex] = useState(-1);
	const [savedDraft, setSavedDraft] = useState<ComposerSavedDraft | null>(
		null,
	);
	const [hydratedStorageKey, setHydratedStorageKey] = useState<string | null>(
		null,
	);
	const historyStorageKey = useMemo(
		() =>
			`experimental-desktop:composer-history:${workspaceRoot ?? "global"}`,
		[workspaceRoot],
	);

	useEffect(() => {
		const saved = window.localStorage.getItem(historyStorageKey);
		if (!saved) {
			setHistory([]);
			setHydratedStorageKey(historyStorageKey);
			return;
		}
		try {
			const parsed = JSON.parse(saved) as ComposerHistoryEntry[];
			setHistory(Array.isArray(parsed) ? parsed.slice(0, 80) : []);
		} catch {
			setHistory([]);
		}
		setHydratedStorageKey(historyStorageKey);
	}, [historyStorageKey]);

	useEffect(() => {
		if (hydratedStorageKey !== historyStorageKey) {
			return;
		}
		window.localStorage.setItem(
			historyStorageKey,
			JSON.stringify(history.slice(0, 80)),
		);
	}, [history, historyStorageKey, hydratedStorageKey]);

	return {
		history,
		setHistory,
		historyIndex,
		setHistoryIndex,
		savedDraft,
		setSavedDraft,
	};
}
