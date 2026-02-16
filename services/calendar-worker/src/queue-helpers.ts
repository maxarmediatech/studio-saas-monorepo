export const DEFAULT_MAX_ATTEMPTS = 5;

export function normalizeAttemptCount(attempts: number | null | undefined) {
	if (
		typeof attempts !== "number" ||
		Number.isNaN(attempts) ||
		attempts < 0
	) {
		return 0;
	}
	return Math.floor(attempts);
}

export function normalizeMaxAttempts(maxAttempts: number | null | undefined) {
	if (
		typeof maxAttempts !== "number" ||
		Number.isNaN(maxAttempts) ||
		maxAttempts < 1
	) {
		return DEFAULT_MAX_ATTEMPTS;
	}
	return Math.floor(maxAttempts);
}

export function hasAttemptsRemaining(params: {
	attempts: number | null | undefined;
	maxAttempts: number | null | undefined;
}) {
	return (
		normalizeAttemptCount(params.attempts) <
		normalizeMaxAttempts(params.maxAttempts)
	);
}

export function computeNextAttemptAt(attempts: number, now = Date.now()) {
	const safeAttempts = Math.max(1, normalizeAttemptCount(attempts));
	const delaySeconds = Math.min(30 * safeAttempts, 15 * 60);
	return new Date(now + delaySeconds * 1000);
}

export function computeNextAttemptAfterFailure(params: {
	attempts: number | null | undefined;
	maxAttempts: number | null | undefined;
	now?: number;
}) {
	if (
		!hasAttemptsRemaining({
			attempts: params.attempts,
			maxAttempts: params.maxAttempts,
		})
	) {
		return null;
	}

	return computeNextAttemptAt(
		normalizeAttemptCount(params.attempts),
		params.now,
	);
}
