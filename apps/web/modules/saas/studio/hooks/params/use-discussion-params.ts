"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";

interface DiscussionParams {
	createDiscussion: boolean;
	discussionId: string | null;
	channelId: string | null;
	linkType: string | null;
	linkId: string | null;
}

interface OpenCreateOptions {
	channelId?: string;
	linkType?: string;
	linkId?: string;
}

const PARAM_KEYS = {
	create: "createDiscussion",
	id: "discussionId",
	channelId: "channelId",
	linkType: "linkType",
	linkId: "linkId",
} as const;

const emptyParams: DiscussionParams = {
	createDiscussion: false,
	discussionId: null,
	channelId: null,
	linkType: null,
	linkId: null,
};

const subscribers = new Set<() => void>();
let cachedSnapshot: DiscussionParams = emptyParams;
let isInitialized = false;

function notifySubscribers() {
	for (const subscriber of subscribers) {
		subscriber();
	}
}

function readFromURL(): DiscussionParams {
	if (typeof window === "undefined") {
		return emptyParams;
	}
	const searchParams = new URLSearchParams(window.location.search);
	return {
		createDiscussion: searchParams.get(PARAM_KEYS.create) === "true",
		discussionId: searchParams.get(PARAM_KEYS.id),
		channelId: searchParams.get(PARAM_KEYS.channelId),
		linkType: searchParams.get(PARAM_KEYS.linkType),
		linkId: searchParams.get(PARAM_KEYS.linkId),
	};
}

function syncFromURL() {
	const newSnapshot = readFromURL();
	if (
		cachedSnapshot.createDiscussion !== newSnapshot.createDiscussion ||
		cachedSnapshot.discussionId !== newSnapshot.discussionId ||
		cachedSnapshot.channelId !== newSnapshot.channelId ||
		cachedSnapshot.linkType !== newSnapshot.linkType ||
		cachedSnapshot.linkId !== newSnapshot.linkId
	) {
		cachedSnapshot = newSnapshot;
		notifySubscribers();
	}
}

function isSheetOpen(): boolean {
	const searchParams = new URLSearchParams(window.location.search);
	return (
		searchParams.has(PARAM_KEYS.id) ||
		searchParams.get(PARAM_KEYS.create) === "true"
	);
}

function updateURL(updates: Partial<DiscussionParams>) {
	const url = new URL(window.location.href);
	const wasOpen = isSheetOpen();

	if ("createDiscussion" in updates) {
		if (updates.createDiscussion) {
			url.searchParams.set(PARAM_KEYS.create, "true");
		} else {
			url.searchParams.delete(PARAM_KEYS.create);
		}
	}

	if ("discussionId" in updates) {
		if (updates.discussionId) {
			url.searchParams.set(PARAM_KEYS.id, updates.discussionId);
		} else {
			url.searchParams.delete(PARAM_KEYS.id);
		}
	}

	if ("channelId" in updates) {
		if (updates.channelId) {
			url.searchParams.set(PARAM_KEYS.channelId, updates.channelId);
		} else {
			url.searchParams.delete(PARAM_KEYS.channelId);
		}
	}

	if ("linkType" in updates) {
		if (updates.linkType) {
			url.searchParams.set(PARAM_KEYS.linkType, updates.linkType);
		} else {
			url.searchParams.delete(PARAM_KEYS.linkType);
		}
	}

	if ("linkId" in updates) {
		if (updates.linkId) {
			url.searchParams.set(PARAM_KEYS.linkId, updates.linkId);
		} else {
			url.searchParams.delete(PARAM_KEYS.linkId);
		}
	}

	const willBeOpen =
		url.searchParams.has(PARAM_KEYS.id) ||
		url.searchParams.get(PARAM_KEYS.create) === "true";

	const isOpening = !wasOpen && willBeOpen;

	if (isOpening) {
		window.history.pushState(window.history.state, "", url.toString());
	} else {
		window.history.replaceState(window.history.state, "", url.toString());
	}

	syncFromURL();
}

let popstateHandler: (() => void) | null = null;
let listenerCount = 0;

function subscribe(callback: () => void) {
	subscribers.add(callback);

	if (!isInitialized && typeof window !== "undefined") {
		cachedSnapshot = readFromURL();
		isInitialized = true;
	}

	if (typeof window !== "undefined" && listenerCount === 0) {
		popstateHandler = () => syncFromURL();
		window.addEventListener("popstate", popstateHandler);
	}
	listenerCount++;

	return () => {
		subscribers.delete(callback);
		if (subscribers.size === 0) {
			isInitialized = false;
			cachedSnapshot = emptyParams;
		}
		listenerCount--;
		if (listenerCount === 0 && popstateHandler) {
			window.removeEventListener("popstate", popstateHandler);
			popstateHandler = null;
		}
	};
}

function getSnapshot(): DiscussionParams {
	if (typeof window !== "undefined" && !isInitialized) {
		cachedSnapshot = readFromURL();
		isInitialized = true;
	}
	return cachedSnapshot;
}

function getServerSnapshot(): DiscussionParams {
	return emptyParams;
}

export function useDiscussionParams() {
	const params = useSyncExternalStore(
		subscribe,
		getSnapshot,
		getServerSnapshot,
	);

	useEffect(() => {
		syncFromURL();
	}, []);

	const openCreate = useCallback((options?: OpenCreateOptions) => {
		updateURL({
			createDiscussion: true,
			discussionId: null,
			channelId: options?.channelId ?? null,
			linkType: options?.linkType ?? null,
			linkId: options?.linkId ?? null,
		});
	}, []);

	const openView = useCallback((discussionId: string) => {
		updateURL({
			discussionId,
			createDiscussion: false,
			channelId: null,
			linkType: null,
			linkId: null,
		});
	}, []);

	const close = useCallback(() => {
		updateURL({
			createDiscussion: false,
			discussionId: null,
			channelId: null,
			linkType: null,
			linkId: null,
		});
	}, []);

	return {
		...params,
		openCreate,
		openView,
		close,
	};
}
