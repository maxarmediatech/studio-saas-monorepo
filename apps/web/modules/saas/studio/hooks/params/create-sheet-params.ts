"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";

/**
 * Factory for creating URL-based sheet params hooks using History API directly.
 * This avoids Next.js router re-renders by using history.replaceState/pushState.
 *
 * Features:
 * - No Next.js router involvement = no layout re-renders
 * - Browser back button closes open sheets (uses pushState for open)
 * - Handles hydration correctly (no flash)
 * - Only components using the hook re-render on changes
 * - HMR-safe with ref-counted popstate listener
 */

export interface SheetParamsConfig {
	/** Unique namespace for global state (e.g., "task", "booking") */
	namespace: string;
	/** URL param name for entity ID (e.g., "taskId") */
	idParam: string;
	/** URL param name for create mode (e.g., "createTask") */
	createParam: string;
}

export interface SheetParams {
	/** Entity ID from URL (e.g., taskId value) */
	entityId: string | null;
	/** Whether create mode is active */
	createMode: boolean;
}

export interface SheetParamsUpdate {
	entityId?: string | null;
	createMode?: boolean | null;
}

export interface SheetParamsHookReturn {
	/** Entity ID from URL */
	entityId: string | null;
	/** Whether create mode is active */
	createMode: boolean;
	/** Set params directly */
	setParams: (params: SheetParamsUpdate) => void;
	/** Open create sheet */
	openCreate: () => void;
	/** Open edit sheet with entity ID */
	openEdit: (id: string) => void;
	/** Open view sheet with entity ID (alias for openEdit) */
	openView: (id: string) => void;
	/** Close sheet */
	close: () => void;
}

type GlobalWithPopstateHandler = typeof globalThis & {
	[key: string]: (() => void) | number | undefined;
};

function getGlobal() {
	return globalThis as GlobalWithPopstateHandler;
}

function capitalize(str: string): string {
	return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Creates a URL-based sheet params hook for a specific entity type.
 *
 * @example
 * ```ts
 * export const useTaskParams = createSheetParams({
 *   namespace: "task",
 *   idParam: "taskId",
 *   createParam: "createTask",
 * });
 *
 * // Usage in component:
 * const { entityId, createMode, openCreate, openEdit, close } = useTaskParams();
 * // Or with aliased names:
 * const { entityId: taskId, createMode: createTask, ... } = useTaskParams();
 * ```
 */
export function createSheetParams(config: SheetParamsConfig) {
	const { namespace, idParam, createParam } = config;

	// Generate unique global keys for this namespace
	const POPSTATE_HANDLER_KEY = `__studio${capitalize(namespace)}PopstateHandler`;
	const POPSTATE_COUNT_KEY = `__studio${capitalize(namespace)}PopstateCount`;

	const emptyParams: SheetParams = {
		entityId: null,
		createMode: false,
	};

	// Module-scoped state for this hook instance
	const subscribers = new Set<() => void>();
	let cachedSnapshot: SheetParams = emptyParams;
	let isInitialized = false;

	function getPopstateHandler(): (() => void) | undefined {
		return getGlobal()[POPSTATE_HANDLER_KEY] as (() => void) | undefined;
	}

	function setPopstateHandler(handler: (() => void) | undefined) {
		if (handler) {
			getGlobal()[POPSTATE_HANDLER_KEY] = handler;
		} else {
			delete getGlobal()[POPSTATE_HANDLER_KEY];
		}
	}

	function getGlobalCount(): number {
		return (getGlobal()[POPSTATE_COUNT_KEY] as number) ?? 0;
	}

	function setGlobalCount(count: number) {
		if (count > 0) {
			getGlobal()[POPSTATE_COUNT_KEY] = count;
		} else {
			delete getGlobal()[POPSTATE_COUNT_KEY];
		}
	}

	function notifySubscribers() {
		for (const subscriber of subscribers) {
			subscriber();
		}
	}

	function readFromURL(): SheetParams {
		if (typeof window === "undefined") {
			return emptyParams;
		}
		const searchParams = new URLSearchParams(window.location.search);
		const entityId = searchParams.get(idParam);
		const createMode = searchParams.get(createParam);

		return {
			entityId,
			createMode: createMode === "true",
		};
	}

	function syncFromURL() {
		const newSnapshot = readFromURL();
		// Only update if values actually changed
		if (
			cachedSnapshot.entityId !== newSnapshot.entityId ||
			cachedSnapshot.createMode !== newSnapshot.createMode
		) {
			cachedSnapshot = newSnapshot;
			notifySubscribers();
		}
	}

	function addPopstateListener() {
		const globalCount = getGlobalCount();
		if (globalCount === 0) {
			const handler = () => syncFromURL();
			setPopstateHandler(handler);
			window.addEventListener("popstate", handler);
		}
		const nextCount = globalCount + 1;
		setGlobalCount(nextCount);
	}

	function removePopstateListener() {
		const globalCount = getGlobalCount();
		const nextCount = Math.max(0, globalCount - 1);
		if (nextCount === 0) {
			const handler = getPopstateHandler();
			if (handler) {
				window.removeEventListener("popstate", handler);
			}
			setPopstateHandler(undefined);
		}
		setGlobalCount(nextCount);
	}

	function subscribe(callback: () => void) {
		subscribers.add(callback);

		// Initialize on first subscription (after hydration)
		if (!isInitialized && typeof window !== "undefined") {
			cachedSnapshot = readFromURL();
			isInitialized = true;
		}

		// Add popstate listener with ref-counting (HMR-safe)
		if (typeof window !== "undefined") {
			addPopstateListener();
		}

		return () => {
			subscribers.delete(callback);
			// Reset state when all subscribers unmount to prevent stale data on remount
			if (subscribers.size === 0) {
				isInitialized = false;
				cachedSnapshot = emptyParams;
			}
			if (typeof window !== "undefined") {
				removePopstateListener();
			}
		};
	}

	function getSnapshot(): SheetParams {
		// Ensure we have the latest on client
		if (typeof window !== "undefined" && !isInitialized) {
			cachedSnapshot = readFromURL();
			isInitialized = true;
		}
		return cachedSnapshot;
	}

	function getServerSnapshot(): SheetParams {
		return emptyParams;
	}

	/**
	 * Check if a sheet is currently open based on URL params
	 */
	function isSheetOpen(): boolean {
		const searchParams = new URLSearchParams(window.location.search);
		return (
			searchParams.has(idParam) ||
			searchParams.get(createParam) === "true"
		);
	}

	/**
	 * Update URL with sheet params.
	 * - Opening a sheet uses pushState (so back button closes it)
	 * - Closing a sheet uses replaceState (to avoid back-forward loops)
	 */
	function updateURL(
		updates: SheetParamsUpdate,
		options: { replace?: boolean } = {},
	) {
		const url = new URL(window.location.href);
		const wasOpen = isSheetOpen();

		// Handle entityId
		if ("entityId" in updates) {
			if (
				updates.entityId === null ||
				updates.entityId === undefined ||
				updates.entityId === ""
			) {
				url.searchParams.delete(idParam);
			} else {
				url.searchParams.set(idParam, updates.entityId);
			}
		}

		// Handle createMode
		if ("createMode" in updates) {
			if (updates.createMode === true) {
				url.searchParams.set(createParam, "true");
			} else {
				url.searchParams.delete(createParam);
			}
		}

		// Determine if we're opening or closing
		const willBeOpen =
			url.searchParams.has(idParam) ||
			url.searchParams.get(createParam) === "true";

		const isOpening = !wasOpen && willBeOpen;
		const shouldPush = isOpening && !options.replace;

		if (shouldPush) {
			// Opening: push so back button can close
			window.history.pushState(window.history.state, "", url.toString());
		} else {
			// Closing or updating: replace to avoid history pollution
			window.history.replaceState(
				window.history.state,
				"",
				url.toString(),
			);
		}

		// Update cached snapshot and notify
		syncFromURL();
	}

	// Return the hook function
	return function useSheetParams(): SheetParamsHookReturn {
		const params = useSyncExternalStore(
			subscribe,
			getSnapshot,
			getServerSnapshot,
		);

		// Sync on mount to handle SSR -> client hydration with URL params
		useEffect(() => {
			syncFromURL();
		}, []);

		const openCreate = useCallback(() => {
			updateURL({
				createMode: true,
				entityId: null,
			});
		}, []);

		const openEdit = useCallback((id: string) => {
			updateURL({
				entityId: id,
				createMode: null,
			});
		}, []);

		// openView is an alias for openEdit (backward compatibility)
		const openView = useCallback((id: string) => {
			updateURL({
				entityId: id,
				createMode: null,
			});
		}, []);

		const close = useCallback(() => {
			updateURL({
				entityId: null,
				createMode: null,
			});
		}, []);

		const setParams = useCallback((newParams: SheetParamsUpdate) => {
			updateURL(newParams);
		}, []);

		return {
			entityId: params.entityId,
			createMode: params.createMode,
			setParams,
			openCreate,
			openEdit,
			openView,
			close,
		};
	};
}
