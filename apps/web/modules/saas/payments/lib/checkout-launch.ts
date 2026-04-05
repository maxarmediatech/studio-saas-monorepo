export function buildCheckoutLaunchPath({
	checkoutUrl,
	checkoutSessionId,
	expectedPriceKeys,
	postCheckoutPath,
	mode,
}: {
	checkoutUrl: string;
	checkoutSessionId: string;
	expectedPriceKeys: string[];
	postCheckoutPath: string;
	mode: "hosted" | "inline";
}) {
	const searchParams = new URLSearchParams({
		checkoutUrl,
		checkoutSessionId,
		mode,
		redirectTo: postCheckoutPath,
	});

	if (expectedPriceKeys.length > 0) {
		searchParams.set("prices", expectedPriceKeys.join(","));
	}

	return `/checkout/launch?${searchParams.toString()}`;
}
