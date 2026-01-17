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

/**
 * Format a package type key to readable label
 * e.g., "wedding_package" -> "Wedding Package"
 */
export function formatPackageType(
	type: string | null | undefined,
	options?: { fallback?: string },
): string {
	if (!type) return options?.fallback ?? "Standard";
	return type
		.split("_")
		.map(
			(word) =>
				word.charAt(0).toUpperCase() + word.slice(1).toLowerCase(),
		)
		.join(" ");
}

/**
 * Get badge variant for status values
 */
export function getStatusVariant(
	status: string,
): "default" | "secondary" | "destructive" | "outline" {
	switch (status) {
		case "pending":
		case "todo":
			return "secondary";
		case "in_progress":
		case "in_revision":
			return "default";
		case "completed":
			return "outline";
		case "cancelled":
			return "destructive";
		default:
			return "default";
	}
}

/**
 * Get badge variant for priority values (used by tasks)
 */
export function getPriorityVariant(
	priority: string,
): "default" | "secondary" | "destructive" | "outline" {
	switch (priority) {
		case "high":
			return "destructive";
		case "medium":
			return "secondary";
		case "low":
			return "outline";
		default:
			return "default";
	}
}
