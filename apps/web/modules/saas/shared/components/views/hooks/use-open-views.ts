"use client";

import { useCallback, useEffect, useState } from "react";
import type { SavedViewEntityType } from "../types";

const STORAGE_KEY_PREFIX = "open-views-";
const MAX_RECENT_VIEWS = 5;

interface OpenViewsState {
	openIds: string[];
	recentIds: string[];
}

function getStorageKey(entityType: SavedViewEntityType): string {
	return `${STORAGE_KEY_PREFIX}${entityType}`;
}

function loadState(entityType: SavedViewEntityType): OpenViewsState {
	if (typeof window === "undefined") {
		return { openIds: [], recentIds: [] };
	}
	try {
		const stored = localStorage.getItem(getStorageKey(entityType));
		if (stored) {
			return JSON.parse(stored);
		}
	} catch {
		// Ignore parse errors
	}
	return { openIds: [], recentIds: [] };
}

function saveState(
	entityType: SavedViewEntityType,
	state: OpenViewsState,
): void {
	if (typeof window === "undefined") {
		return;
	}
	try {
		localStorage.setItem(getStorageKey(entityType), JSON.stringify(state));
	} catch {
		// Ignore storage errors
	}
}

interface UseOpenViewsOptions {
	entityType: SavedViewEntityType;
}

export function useOpenViews({ entityType }: UseOpenViewsOptions) {
	const [state, setState] = useState<OpenViewsState>(() =>
		loadState(entityType),
	);

	useEffect(() => {
		setState(loadState(entityType));
	}, [entityType]);

	useEffect(() => {
		saveState(entityType, state);
	}, [entityType, state]);

	const addToRecent = useCallback((viewId: string) => {
		setState((prev) => {
			const filtered = prev.recentIds.filter((id) => id !== viewId);
			const newRecent = [viewId, ...filtered].slice(0, MAX_RECENT_VIEWS);
			return { ...prev, recentIds: newRecent };
		});
	}, []);

	const openView = useCallback(
		(viewId: string) => {
			setState((prev) => {
				if (prev.openIds.includes(viewId)) {
					return prev;
				}
				return { ...prev, openIds: [...prev.openIds, viewId] };
			});
			addToRecent(viewId);
		},
		[addToRecent],
	);

	const closeView = useCallback((viewId: string) => {
		setState((prev) => ({
			...prev,
			openIds: prev.openIds.filter((id) => id !== viewId),
		}));
	}, []);

	const clearAll = useCallback(() => {
		setState({ openIds: [], recentIds: [] });
	}, []);

	return {
		openIds: state.openIds,
		recentIds: state.recentIds,
		openView,
		closeView,
		addToRecent,
		clearAll,
	};
}
