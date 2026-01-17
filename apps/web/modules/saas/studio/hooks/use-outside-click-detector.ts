"use client";

import { type RefObject, useEffect } from "react";

/**
 * Hook to detect clicks outside of a specified element.
 * Useful for closing dropdowns, modals, or FABs when clicking outside.
 *
 * @param ref - React ref to the element to detect clicks outside of
 * @param callback - Function to call when a click outside is detected
 * @param enabled - Whether the detection is enabled (default: true)
 */
export function useOutsideClickDetector(
	ref: RefObject<HTMLElement | null>,
	callback: () => void,
	enabled = true,
): void {
	useEffect(() => {
		if (!enabled) return;

		const handleClickOutside = (event: MouseEvent | TouchEvent) => {
			if (ref.current && !ref.current.contains(event.target as Node)) {
				callback();
			}
		};

		// Use mousedown instead of click for better UX (fires before focus changes)
		document.addEventListener("mousedown", handleClickOutside);
		document.addEventListener("touchstart", handleClickOutside);

		return () => {
			document.removeEventListener("mousedown", handleClickOutside);
			document.removeEventListener("touchstart", handleClickOutside);
		};
	}, [ref, callback, enabled]);
}
