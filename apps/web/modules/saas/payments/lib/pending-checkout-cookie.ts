import Cookies from "js-cookie";

export const PENDING_CHECKOUT_COOKIE_NAME = "pendingCheckout";

export const PENDING_CHECKOUT_MAX_AGE_SECONDS = 60 * 15;

export type PendingCheckoutCookie = {
	sessionId: string;
	expectedProductIds: string[];
	postCheckoutPath: string;
	createdAt: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

export function readPendingCheckoutCookie(
	value: string | null | undefined,
): PendingCheckoutCookie | null {
	if (!value) {
		return null;
	}

	try {
		const parsed = JSON.parse(decodeURIComponent(value)) as unknown;

		if (!isRecord(parsed)) {
			return null;
		}

		const sessionId =
			typeof parsed.sessionId === "string" ? parsed.sessionId : null;
		const postCheckoutPath =
			typeof parsed.postCheckoutPath === "string"
				? parsed.postCheckoutPath
				: null;
		const createdAt =
			typeof parsed.createdAt === "number" ? parsed.createdAt : null;
		const expectedProductIds = Array.isArray(parsed.expectedProductIds)
			? parsed.expectedProductIds.filter(
					(value): value is string => typeof value === "string",
				)
			: [];

		if (!(sessionId && postCheckoutPath && createdAt)) {
			return null;
		}

		return {
			sessionId,
			postCheckoutPath,
			createdAt,
			expectedProductIds,
		};
	} catch {
		return null;
	}
}

export function setPendingCheckoutCookie(payload: PendingCheckoutCookie) {
	if (typeof window === "undefined") {
		return;
	}

	Cookies.set(PENDING_CHECKOUT_COOKIE_NAME, JSON.stringify(payload), {
		expires: new Date(Date.now() + PENDING_CHECKOUT_MAX_AGE_SECONDS * 1000),
		path: "/",
		sameSite: "lax",
		secure: window.location.protocol === "https:",
	});
}

export function clearPendingCheckoutCookie() {
	if (typeof window === "undefined") {
		return;
	}

	Cookies.remove(PENDING_CHECKOUT_COOKIE_NAME, {
		path: "/",
		sameSite: "lax",
		secure: window.location.protocol === "https:",
	});
}
