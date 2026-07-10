"use client";

import { useCallback, useRef } from "react";

function canonicalize(value: unknown): unknown {
	if (Array.isArray(value)) {
		return value.map(canonicalize);
	}
	if (value && typeof value === "object") {
		return Object.fromEntries(
			Object.entries(value as Record<string, unknown>)
				.sort(([left], [right]) => left.localeCompare(right))
				.map(([key, child]) => [key, canonicalize(child)]),
		);
	}
	return value;
}

/** Keeps one key for the same submitted business payload, including retries. */
export function usePaymentSubmissionKey() {
	const current = useRef<{ fingerprint: string; key: string } | null>(null);

	const keyFor = useCallback((payload: Record<string, unknown>) => {
		const fingerprint = JSON.stringify(canonicalize(payload));
		if (current.current?.fingerprint === fingerprint) {
			return current.current.key;
		}

		const key = crypto.randomUUID();
		current.current = { fingerprint, key };
		return key;
	}, []);

	const acknowledgeSuccess = useCallback(() => {
		current.current = null;
	}, []);

	return { acknowledgeSuccess, keyFor };
}
