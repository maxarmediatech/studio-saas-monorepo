import { useEffect, useRef, useState } from "react";
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

	useEffect(() => {
		setContextItems(input.initialContextItems);
	}, [input.initialContextItems, input.resetSignal]);

	useEffect(() => {
		input.onContextItemsChange(contextItems);
	}, [contextItems, input.onContextItemsChange]);

	function addContextItem(item: ComposerContextItem) {
		setContextItems((items) =>
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
		setContextItems((items) =>
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
			setContextItems((items) =>
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
			setContextItems((items) =>
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

	return {
		contextItems,
		setContextItems,
		addContextItem,
		changeFolderMode,
	};
}
