"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";

/**
 * URL-based configuration sheet params using History API directly.
 * This avoids Next.js router re-renders by using history.replaceState/pushState.
 *
 * Features:
 * - No Next.js router involvement = no layout re-renders
 * - Browser back button closes open sheets (uses pushState for open)
 * - Handles hydration correctly
 * - Only components using this hook re-render on changes
 * - HMR-safe with ref-counted popstate listener
 */

type ConfigurationParams = {
	configurationId: string | null;
	createConfiguration: boolean;
	configurationType: string | null;
};

/** For updates, allow null to clear any param */
type ConfigurationParamsUpdate = {
	[K in keyof ConfigurationParams]?: ConfigurationParams[K] | null;
};

const emptyParams: ConfigurationParams = {
	configurationId: null,
	createConfiguration: false,
	configurationType: null,
};

// Subscribers for URL changes
const subscribers = new Set<() => void>();

// Cached snapshot to ensure referential stability
let cachedSnapshot: ConfigurationParams = emptyParams;
let isInitialized = false;
let popstateListenerCount = 0;

const POPSTATE_HANDLER_KEY = "__studioConfigurationPopstateHandler";
const POPSTATE_COUNT_KEY = "__studioConfigurationPopstateCount";

type GlobalWithPopstateHandler = typeof globalThis & {
	[POPSTATE_HANDLER_KEY]?: () => void;
	[POPSTATE_COUNT_KEY]?: number;
};

function getGlobal() {
	return globalThis as GlobalWithPopstateHandler;
}

function getPopstateHandler() {
	return getGlobal()[POPSTATE_HANDLER_KEY];
}

function setPopstateHandler(handler: (() => void) | undefined) {
	if (handler) {
		getGlobal()[POPSTATE_HANDLER_KEY] = handler;
	} else {
		delete getGlobal()[POPSTATE_HANDLER_KEY];
	}
}

function getGlobalCount() {
	return getGlobal()[POPSTATE_COUNT_KEY] ?? 0;
}

function setGlobalCount(count: number) {
	if (count > 0) {
		getGlobal()[POPSTATE_COUNT_KEY] = count;
	} else {
		delete getGlobal()[POPSTATE_COUNT_KEY];
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
	popstateListenerCount = nextCount;
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
	popstateListenerCount = nextCount;
}

function notifySubscribers() {
	for (const subscriber of subscribers) {
		subscriber();
	}
}

function readFromURL(): ConfigurationParams {
	if (typeof window === "undefined") {
		return emptyParams;
	}
	const searchParams = new URLSearchParams(window.location.search);
	const configurationId = searchParams.get("configurationId");
	const createConfiguration = searchParams.get("createConfiguration");
	const configurationType = searchParams.get("configurationType");

	return {
		configurationId,
		createConfiguration: createConfiguration === "true",
		configurationType,
	};
}

function syncFromURL() {
	const newSnapshot = readFromURL();
	// Only update if values actually changed
	if (
		cachedSnapshot.configurationId !== newSnapshot.configurationId ||
		cachedSnapshot.createConfiguration !== newSnapshot.createConfiguration ||
		cachedSnapshot.configurationType !== newSnapshot.configurationType
	) {
		cachedSnapshot = newSnapshot;
		notifySubscribers();
	}
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
		if (typeof window !== "undefined") {
			removePopstateListener();
		}
	};
}

function getSnapshot(): ConfigurationParams {
	// Ensure we have the latest on client
	if (typeof window !== "undefined" && !isInitialized) {
		cachedSnapshot = readFromURL();
		isInitialized = true;
	}
	return cachedSnapshot;
}

function getServerSnapshot(): ConfigurationParams {
	return emptyParams;
}

/**
 * Check if a sheet is currently open based on URL params
 */
function isSheetOpen(): boolean {
	const searchParams = new URLSearchParams(window.location.search);
	return (
		searchParams.has("configurationId") ||
		searchParams.get("createConfiguration") === "true"
	);
}

/**
 * Update URL with configuration params.
 * - Opening a sheet uses pushState (so back button closes it)
 * - Closing a sheet uses replaceState (to avoid back-forward loops)
 */
function updateURL(
	updates: ConfigurationParamsUpdate,
	options: { replace?: boolean } = {},
) {
	const url = new URL(window.location.href);
	const wasOpen = isSheetOpen();

	for (const [key, value] of Object.entries(updates)) {
		if (value === null || value === false || value === "") {
			url.searchParams.delete(key);
		} else if (value === true) {
			url.searchParams.set(key, "true");
		} else if (typeof value === "string") {
			url.searchParams.set(key, value);
		}
	}

	// Determine if we're opening or closing
	const willBeOpen =
		url.searchParams.has("configurationId") ||
		url.searchParams.get("createConfiguration") === "true";

	const isOpening = !wasOpen && willBeOpen;
	const shouldPush = isOpening && !options.replace;

	if (shouldPush) {
		// Opening: push so back button can close
		window.history.pushState(window.history.state, "", url.toString());
	} else {
		// Closing or updating: replace to avoid history pollution
		window.history.replaceState(window.history.state, "", url.toString());
	}

	// Update cached snapshot and notify
	syncFromURL();
}

export function useConfigurationParams() {
	const params = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

	// Sync on mount to handle SSR -> client hydration with URL params
	useEffect(() => {
		syncFromURL();
	}, []);

	const openCreate = useCallback((type: string) => {
		updateURL({
			createConfiguration: true,
			configurationType: type,
			configurationId: null,
		});
	}, []);

	const openEdit = useCallback((id: string, type: string) => {
		updateURL({
			configurationId: id,
			configurationType: type,
			createConfiguration: null,
		});
	}, []);

	const close = useCallback(() => {
		updateURL({
			configurationId: null,
			createConfiguration: null,
			configurationType: null,
		});
	}, []);

	const setParams = useCallback((newParams: ConfigurationParamsUpdate) => {
		updateURL(newParams);
	}, []);

	return {
		...params,
		setParams,
		openCreate,
		openEdit,
		close,
	};
}
