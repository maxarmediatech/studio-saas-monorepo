export type InvoiceStatus =
	| "draft"
	| "sent"
	| "paid"
	| "partial"
	| "overdue"
	| "cancelled";

const VALID_TRANSITIONS: Record<InvoiceStatus, InvoiceStatus[]> = {
	draft: ["sent", "cancelled"],
	sent: ["paid", "partial", "overdue", "cancelled"],
	partial: ["paid", "overdue", "cancelled"],
	paid: ["cancelled"],
	overdue: ["paid", "partial", "cancelled"],
	cancelled: [],
};

export function isValidStatusTransition(
	currentStatus: InvoiceStatus,
	newStatus: InvoiceStatus,
): boolean {
	if (currentStatus === newStatus) return true;
	return VALID_TRANSITIONS[currentStatus]?.includes(newStatus) ?? false;
}

export function getInvalidTransitionMessage(
	currentStatus: InvoiceStatus,
	newStatus: InvoiceStatus,
): string {
	if (currentStatus === "cancelled") {
		return "Cannot change status of a cancelled invoice";
	}
	if (currentStatus === "paid" && newStatus !== "cancelled") {
		return "Paid invoices can only be cancelled";
	}
	if (currentStatus === "draft" && newStatus === "paid") {
		return "Cannot mark a draft invoice as paid directly. It must be sent first.";
	}
	return `Cannot transition invoice from ${currentStatus} to ${newStatus}`;
}
