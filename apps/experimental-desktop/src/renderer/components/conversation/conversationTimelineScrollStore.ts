import type { TimelineScrollAnchor } from "./conversationTimelineScroll";

export type ConversationTimelineScrollSnapshot = {
	anchor?: TimelineScrollAnchor;
	followingBottom: boolean;
	scrollTop: number;
};

const storagePrefix = "experimental-desktop:conversation-timeline-scroll:";
const snapshots = new Map<string, ConversationTimelineScrollSnapshot>();

export function readConversationTimelineScrollSnapshot(conversationId?: string) {
	if (!conversationId) {
		return undefined;
	}
	const cached = snapshots.get(conversationId);
	if (cached) {
		return cached;
	}
	const stored = readStoredSnapshot(conversationId);
	if (stored) {
		snapshots.set(conversationId, stored);
	}
	return stored;
}

export function writeConversationTimelineScrollSnapshot(
	conversationId: string | undefined,
	snapshot: ConversationTimelineScrollSnapshot,
) {
	if (!conversationId) {
		return;
	}
	snapshots.set(conversationId, snapshot);
	writeStoredSnapshot(conversationId, snapshot);
}

function readStoredSnapshot(conversationId: string) {
	try {
		const raw = window.sessionStorage.getItem(`${storagePrefix}${conversationId}`);
		if (!raw) {
			return undefined;
		}
		const parsed = JSON.parse(raw) as ConversationTimelineScrollSnapshot;
		if (typeof parsed.scrollTop !== "number") {
			return undefined;
		}
		return parsed;
	} catch {
		return undefined;
	}
}

function writeStoredSnapshot(
	conversationId: string,
	snapshot: ConversationTimelineScrollSnapshot,
) {
	try {
		window.sessionStorage.setItem(
			`${storagePrefix}${conversationId}`,
			JSON.stringify(snapshot),
		);
	} catch {
		// Scroll state is best-effort UI state.
	}
}
