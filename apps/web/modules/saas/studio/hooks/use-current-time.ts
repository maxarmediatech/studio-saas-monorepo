"use client";

import { useSyncExternalStore } from "react";

let currentTimestamp = Date.now();
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | null = null;

function emitCurrentTime() {
	currentTimestamp = Date.now();
	for (const listener of listeners) {
		listener();
	}
}

function subscribe(listener: () => void) {
	listeners.add(listener);
	if (!timer) {
		emitCurrentTime();
		timer = setInterval(emitCurrentTime, 60000);
	}

	return () => {
		listeners.delete(listener);
		if (listeners.size === 0 && timer) {
			clearInterval(timer);
			timer = null;
		}
	};
}

const getSnapshot = () => currentTimestamp;
const getServerSnapshot = () => null;

export function useCurrentTime() {
	const timestamp = useSyncExternalStore(
		subscribe,
		getSnapshot,
		getServerSnapshot,
	);

	return { currentTime: timestamp === null ? null : new Date(timestamp) };
}
