import {
	isAllowedDodoCheckoutUrl,
	sanitizeCheckoutSessionId,
	sanitizePostCheckoutPath,
} from "@repo/payments/lib/checkout";
import {
	PENDING_CHECKOUT_COOKIE_NAME,
	PENDING_CHECKOUT_MAX_AGE_SECONDS,
} from "@saas/payments/lib/pending-checkout-cookie";
import { NextResponse } from "next/server";

function parseExpectedPriceKeys(value: string | null) {
	if (!value) {
		return [];
	}

	return [
		...new Set(
			value
				.split(",")
				.map((item) => item.trim())
				.filter(Boolean),
		),
	];
}

export async function GET(request: Request) {
	const requestUrl = new URL(request.url);
	const checkoutUrl = requestUrl.searchParams.get("checkoutUrl");
	const checkoutSessionId = sanitizeCheckoutSessionId(
		requestUrl.searchParams.get("checkoutSessionId"),
	);
	const redirectTo = sanitizePostCheckoutPath(
		requestUrl.searchParams.get("redirectTo"),
	);
	const mode = requestUrl.searchParams.get("mode");
	const expectedPriceKeys = parseExpectedPriceKeys(
		requestUrl.searchParams.get("prices") ??
			requestUrl.searchParams.get("products"),
	);

	if (
		!(checkoutUrl && isAllowedDodoCheckoutUrl(checkoutUrl)) ||
		!checkoutSessionId ||
		!(mode === "inline" || mode === "hosted")
	) {
		return NextResponse.redirect(new URL("/choose-plan", requestUrl));
	}

	const response =
		mode === "inline"
			? NextResponse.redirect(
					new URL(
						`/choose-plan/checkout?checkoutUrl=${encodeURIComponent(
							checkoutUrl,
						)}&checkoutSessionId=${encodeURIComponent(
							checkoutSessionId,
						)}&redirectTo=${encodeURIComponent(
							redirectTo,
						)}&prices=${encodeURIComponent(
							expectedPriceKeys.join(","),
						)}`,
						requestUrl,
					),
				)
			: NextResponse.redirect(checkoutUrl);

	response.cookies.set({
		name: PENDING_CHECKOUT_COOKIE_NAME,
		value: encodeURIComponent(
			JSON.stringify({
				sessionId: checkoutSessionId,
				expectedPriceKeys,
				postCheckoutPath: redirectTo,
				createdAt: Date.now(),
			}),
		),
		maxAge: PENDING_CHECKOUT_MAX_AGE_SECONDS,
		path: "/",
		sameSite: "lax",
		secure: requestUrl.protocol === "https:",
	});

	return response;
}
