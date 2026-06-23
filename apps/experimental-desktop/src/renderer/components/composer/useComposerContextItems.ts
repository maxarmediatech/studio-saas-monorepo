import { useEffect, useRef, useState } from "react";
import type { SetStateAction } from "react";
import {
	createFolderContextItem,
	DEFAULT_FOLDER_CONTEXT_PATTERNS,
	folderDescription,
} from "./composerFolderContext";
import type { ComposerContextItem, ComposerFolderMode } from "./composerTypes";

export function useComposerContextItems(input: {
	initialContextItems: ComposerContextItem[];
	resetSignal: number;
	onContextItemsChange: (items: ComposerContextItem[]) => void;
}) {
	const [contextItems, setContextItems] = useState<ComposerContextItem[]>(
		input.initialContextItems,
	);
	const folderScanVersionsRef = useRef<Record<string, number>>({});
	const reportedContextItemsRef = useRef(contextItems);
	const lastResetSignalRef = useRef(input.resetSignal);

	useEffect(() => {
		if (lastResetSignalRef.current === input.resetSignal) {
			return;
		}
		lastResetSignalRef.current = input.resetSignal;
		commitContextItems(input.initialContextItems);
	}, [input.initialContextItems, input.resetSignal]);

	useEffect(() => {
		if (sameContextItemList(reportedContextItemsRef.current, contextItems)) {
			return;
		}
		reportedContextItemsRef.current = contextItems;
		input.onContextItemsChange(contextItems);
	}, [contextItems, input.onContextItemsChange]);

	function addContextItem(item: ComposerContextItem) {
		commitContextItems((items) =>
			items.some((existing) => existing.path === item.path)
				? items
				: [...items, item],
		);
	}

	async function changeFolderMode(path: string, mode: ComposerFolderMode) {
		const target = contextItems.find((item) => item.path === path);
		if (!target) {
			return;
		}
		const version = (folderScanVersionsRef.current[path] ?? 0) + 1;
		folderScanVersionsRef.current[path] = version;
		commitContextItems((items) =>
			items.map((item) =>
				item.path === path
					? {
							...item,
							folderMode: mode,
							folderStatus: "scanning",
							folderError: undefined,
						}
					: item,
			),
		);
		try {
			const snapshot = await window.experimentalDesktop.scanFolderContext(
				{
					path,
					mode,
					patterns:
						mode === "pattern"
							? DEFAULT_FOLDER_CONTEXT_PATTERNS
							: undefined,
				},
			);
			if (folderScanVersionsRef.current[path] !== version) {
				return;
			}
			commitContextItems((items) =>
				items.map((item) =>
					item.path === path
						? createFolderContextItem({
								type:
									item.type === "workspace"
										? "workspace"
										: "directory",
								label: item.label,
								path: item.path,
								mode,
								snapshot,
								description: folderDescription(mode, snapshot),
							})
						: item,
				),
			);
		} catch (error) {
			if (folderScanVersionsRef.current[path] !== version) {
				return;
			}
			const message =
				error instanceof Error ? error.message : String(error);
			commitContextItems((items) =>
				items.map((item) =>
					item.path === path
						? {
								...item,
								folderMode: mode,
								folderStatus: "failed",
								folderError: message,
								description: message,
							}
						: item,
				),
			);
		}
	}

	function commitContextItems(
		nextValue: SetStateAction<ComposerContextItem[]>,
	) {
		setContextItems((items) => {
			const next =
				typeof nextValue === "function" ? nextValue(items) : nextValue;
			if (sameContextItemList(items, next)) {
				return items;
			}
			return next;
		});
	}

	return {
		contextItems,
		setContextItems: commitContextItems,
		addContextItem,
		changeFolderMode,
	};
}

function sameContextItemList(
	a: ComposerContextItem[],
	b: ComposerContextItem[],
) {
	return (
		a.length === b.length &&
		a.every((item, index) => {
			const next = b[index];
			return (
				next &&
				item.path === next.path &&
				item.label === next.label &&
				item.type === next.type &&
				item.folderMode === next.folderMode &&
				item.folderStatus === next.folderStatus &&
				item.folderError === next.folderError &&
				item.folderSnapshot === next.folderSnapshot &&
				item.description === next.description
			);
		})
	);
}
