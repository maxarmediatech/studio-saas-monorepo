export function buildCheckoutLaunchPath({
	checkoutUrl,
	checkoutSessionId,
	expectedProductIds,
	postCheckoutPath,
	mode,
}: {
	checkoutUrl: string;
	checkoutSessionId: string;
	expectedProductIds: string[];
	postCheckoutPath: string;
	mode: "hosted" | "inline";
}) {
	const searchParams = new URLSearchParams({
		checkoutUrl,
		checkoutSessionId,
		mode,
		redirectTo: postCheckoutPath,
	});

	if (expectedProductIds.length > 0) {
		searchParams.set("products", expectedProductIds.join(","));
	}

	return `/checkout/launch?${searchParams.toString()}`;
}
