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

export async function POST(request: Request) {
	const requestUrl = new URL(request.url);
	const requestOrigin = request.headers.get("origin");
	if (requestOrigin !== requestUrl.origin) {
		return NextResponse.redirect(new URL("/choose-plan", requestUrl), 303);
	}

	const formData = await request.formData();
	const getFormValue = (name: string) => {
		const value = formData.get(name);
		return typeof value === "string" ? value : null;
	};
	const checkoutUrl = getFormValue("checkoutUrl");
	const checkoutSessionId = sanitizeCheckoutSessionId(
		getFormValue("checkoutSessionId"),
	);
	const redirectTo = sanitizePostCheckoutPath(getFormValue("redirectTo"));
	const mode = getFormValue("mode");
	const expectedPriceKeys = parseExpectedPriceKeys(
		getFormValue("prices") ?? getFormValue("products"),
	);

	if (
		!(checkoutUrl && isAllowedDodoCheckoutUrl(checkoutUrl)) ||
		!checkoutSessionId ||
		!(mode === "inline" || mode === "hosted")
	) {
		return NextResponse.redirect(new URL("/choose-plan", requestUrl), 303);
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
					303,
				)
			: NextResponse.redirect(checkoutUrl, 303);

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
