/**
 * Format a number or string as Indian Rupees currency
 */
export function formatCurrency(amount: number | string | undefined): string {
	const num =
		typeof amount === "string"
			? Number.parseFloat(amount) || 0
			: (amount ?? 0);
	return new Intl.NumberFormat("en-IN", {
		style: "currency",
		currency: "INR",
		maximumFractionDigits: 0,
	}).format(num);
}
