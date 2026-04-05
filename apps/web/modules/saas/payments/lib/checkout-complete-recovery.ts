type BuildCheckoutCompleteRecoveryPathOptions = {
	checkoutSessionId?: string;
	subscriptionId?: string;
	redirectTo: string;
	expectedPriceKeys: string[];
};

export function buildCheckoutCompleteRecoveryPath({
	checkoutSessionId,
	subscriptionId,
	redirectTo,
	expectedPriceKeys,
}: BuildCheckoutCompleteRecoveryPathOptions) {
	const completionSearchParams = new URLSearchParams();

	if (checkoutSessionId) {
		completionSearchParams.set("checkoutSessionId", checkoutSessionId);
	}

	if (subscriptionId) {
		completionSearchParams.set("subscription_id", subscriptionId);
	}

	completionSearchParams.set("redirectTo", redirectTo);

	if (expectedPriceKeys.length > 0) {
		completionSearchParams.set("prices", expectedPriceKeys.join(","));
	}

	return `/checkout/complete?${completionSearchParams.toString()}`;
}
