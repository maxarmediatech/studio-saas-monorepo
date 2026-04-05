import type { PurchaseSchema } from "@repo/database";
import type { z } from "zod";
import { createPurchasesHelper } from "./helper";

const INTERNAL_REDIRECT_ORIGIN = "https://app.local";
const DEFAULT_POST_CHECKOUT_PATH = "/app";
const CHECKOUT_SESSION_ID_PATTERN = /^[A-Za-z0-9_-]+$/;
const allowedDodoCheckoutHosts = new Set([
	"checkout.dodopayments.com",
	"test.checkout.dodopayments.com",
]);

type PurchaseRecord = z.infer<typeof PurchaseSchema>;
export type CheckoutStatus = {
	status: "active" | "pending" | "failed" | "cancelled";
	purchaseId: string | null;
};

function hasControlCharacters(input: string): boolean {
	for (let index = 0; index < input.length; index += 1) {
		const code = input.charCodeAt(index);
		if ((code >= 0 && code <= 31) || code === 127) {
			return true;
		}
	}

	return false;
}

function parseInternalPath(path: string | null | undefined): string | null {
	if (!path) {
		return null;
	}

	const candidate = path.trim();
	if (
		!candidate ||
		hasControlCharacters(candidate) ||
		candidate.includes("\\") ||
		!candidate.startsWith("/")
	) {
		return null;
	}

	try {
		const parsed = new URL(candidate, INTERNAL_REDIRECT_ORIGIN);
		if (parsed.origin !== INTERNAL_REDIRECT_ORIGIN) {
			return null;
		}

		return `${parsed.pathname}${parsed.search}${parsed.hash}`;
	} catch {
		return null;
	}
}

function getBaseUrl() {
	if (process.env.NEXT_PUBLIC_SITE_URL) {
		return process.env.NEXT_PUBLIC_SITE_URL;
	}

	if (process.env.NEXT_PUBLIC_VERCEL_URL) {
		return `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`;
	}

	return `http://localhost:${process.env.PORT ?? 3000}`;
}

function sortByNewest(a: PurchaseRecord, b: PurchaseRecord) {
	const aTime = a.updatedAt ?? a.createdAt;
	const bTime = b.updatedAt ?? b.createdAt;
	return bTime.getTime() - aTime.getTime();
}

export function sanitizePostCheckoutPath(
	postCheckoutPath: string | null | undefined,
	fallback = DEFAULT_POST_CHECKOUT_PATH,
) {
	return (
		parseInternalPath(postCheckoutPath) ??
		parseInternalPath(fallback) ??
		DEFAULT_POST_CHECKOUT_PATH
	);
}

export function sanitizeCheckoutSessionId(
	checkoutSessionId: string | null | undefined,
) {
	const candidate = checkoutSessionId?.trim();

	if (
		!candidate ||
		candidate.length > 200 ||
		!CHECKOUT_SESSION_ID_PATTERN.test(candidate)
	) {
		return null;
	}

	return candidate;
}

export function buildCheckoutCompletionUrl({
	postCheckoutPath,
	expectedPriceKeys,
}: {
	postCheckoutPath?: string;
	expectedPriceKeys?: string[];
}) {
	const completionUrl = new URL("/checkout/complete", getBaseUrl());
	completionUrl.searchParams.set(
		"redirectTo",
		sanitizePostCheckoutPath(postCheckoutPath),
	);

	const uniquePriceKeys = [
		...new Set(expectedPriceKeys?.filter(Boolean) ?? []),
	];
	if (uniquePriceKeys.length > 0) {
		completionUrl.searchParams.set("prices", uniquePriceKeys.join(","));
	}

	return completionUrl.toString();
}

export function isAllowedDodoCheckoutUrl(urlValue: string): boolean {
	try {
		const url = new URL(urlValue);
		return (
			url.protocol === "https:" &&
			allowedDodoCheckoutHosts.has(url.hostname)
		);
	} catch {
		return false;
	}
}

export function getCheckoutStatusFromPurchases({
	purchases,
	expectedPriceKeys,
	checkoutSessionPaymentStatus,
	checkoutSessionPaymentId,
	checkoutSessionSubscriptionId,
}: {
	purchases: PurchaseRecord[];
	expectedPriceKeys?: string[];
	checkoutSessionPaymentStatus?: string | null;
	checkoutSessionPaymentId?: string | null;
	checkoutSessionSubscriptionId?: string | null;
}): CheckoutStatus {
	const normalizedCheckoutSessionPaymentStatus =
		checkoutSessionPaymentStatus?.toLowerCase() ?? null;
	const normalizedExpectedPriceKeys = [
		...new Set(expectedPriceKeys?.filter(Boolean) ?? []),
	];

	if (normalizedExpectedPriceKeys.length === 0) {
		const { activePlan } = createPurchasesHelper(purchases);
		return activePlan?.hasActivePurchase
			? {
					status: "active" as const,
					purchaseId: activePlan.purchaseId ?? null,
				}
			: { status: "pending" as const, purchaseId: null };
	}

	const matchingPurchases = purchases.filter((purchase) =>
		normalizedExpectedPriceKeys.includes(purchase.priceKey),
	);
	const matchingCheckoutSessionPurchase = checkoutSessionPaymentId
		? (matchingPurchases.find(
				(purchase) => purchase.paymentId === checkoutSessionPaymentId,
			) ?? null)
		: null;
	const matchingCheckoutSessionSubscriptionPurchase =
		checkoutSessionSubscriptionId
			? (matchingPurchases.find(
					(purchase) =>
						purchase.subscriptionId ===
						checkoutSessionSubscriptionId,
				) ?? null)
			: null;
	const { activePlan } = createPurchasesHelper(matchingPurchases);

	if (
		matchingCheckoutSessionSubscriptionPurchase &&
		(normalizedCheckoutSessionPaymentStatus === "succeeded" ||
			normalizedCheckoutSessionPaymentStatus === "active" ||
			normalizedCheckoutSessionPaymentStatus === null)
	) {
		const normalizedMatchedPurchaseStatus =
			matchingCheckoutSessionSubscriptionPurchase.status?.toLowerCase() ??
			"active";

		if (
			normalizedMatchedPurchaseStatus === "active" ||
			normalizedMatchedPurchaseStatus === "trialing"
		) {
			return {
				status: "active" as const,
				purchaseId: matchingCheckoutSessionSubscriptionPurchase.id,
			};
		}
	}

	if (
		matchingCheckoutSessionPurchase &&
		(normalizedCheckoutSessionPaymentStatus === "succeeded" ||
			normalizedCheckoutSessionPaymentStatus === null)
	) {
		const normalizedMatchedPurchaseStatus =
			matchingCheckoutSessionPurchase.status?.toLowerCase() ?? "active";

		if (
			normalizedMatchedPurchaseStatus === "active" ||
			normalizedMatchedPurchaseStatus === "trialing"
		) {
			return {
				status: "active" as const,
				purchaseId: matchingCheckoutSessionPurchase.id,
			};
		}
	}

	if (activePlan?.hasActivePurchase) {
		if (
			normalizedCheckoutSessionPaymentStatus &&
			normalizedCheckoutSessionPaymentStatus !== "succeeded"
		) {
			return normalizedCheckoutSessionPaymentStatus === "cancelled"
				? { status: "cancelled" as const, purchaseId: null }
				: normalizedCheckoutSessionPaymentStatus === "failed"
					? { status: "failed" as const, purchaseId: null }
					: { status: "pending" as const, purchaseId: null };
		}

		if (checkoutSessionPaymentId && !matchingCheckoutSessionPurchase) {
			return { status: "pending" as const, purchaseId: null };
		}

		return {
			status: "active" as const,
			purchaseId: activePlan.purchaseId ?? null,
		};
	}

	if (
		normalizedCheckoutSessionPaymentStatus &&
		normalizedCheckoutSessionPaymentStatus !== "succeeded"
	) {
		return normalizedCheckoutSessionPaymentStatus === "cancelled"
			? { status: "cancelled" as const, purchaseId: null }
			: normalizedCheckoutSessionPaymentStatus === "failed"
				? { status: "failed" as const, purchaseId: null }
				: { status: "pending" as const, purchaseId: null };
	}

	const latestRelevantPurchase = [...matchingPurchases].sort(sortByNewest)[0];
	const normalizedStatus = latestRelevantPurchase?.status?.toLowerCase();

	if (normalizedStatus === "cancelled") {
		return {
			status: "cancelled" as const,
			purchaseId: latestRelevantPurchase.id,
		};
	}

	if (
		normalizedStatus === "failed" ||
		normalizedStatus === "expired" ||
		normalizedStatus === "on_hold"
	) {
		return {
			status: "failed" as const,
			purchaseId: latestRelevantPurchase.id,
		};
	}

	return { status: "pending" as const, purchaseId: null };
}
