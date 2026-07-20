export function submitCheckoutLaunch({
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
	const form = document.createElement("form");
	form.action = "/checkout/launch";
	form.hidden = true;
	form.method = "POST";

	const values = {
		checkoutSessionId,
		checkoutUrl,
		mode,
		prices: expectedPriceKeys.join(","),
		redirectTo: postCheckoutPath,
	};

	for (const [name, value] of Object.entries(values)) {
		const input = document.createElement("input");
		input.name = name;
		input.type = "hidden";
		input.value = value;
		form.append(input);
	}

	document.body.append(form);
	form.submit();
}
