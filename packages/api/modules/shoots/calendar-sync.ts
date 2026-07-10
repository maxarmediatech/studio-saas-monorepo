export const TERMINAL_SHOOT_STATUSES = new Set(["cancelled", "completed"]);

export function normalizeShootStatus(
	status: string | null | undefined,
): string {
	return (status ?? "").trim().toLowerCase();
}

export function isTerminalShootStatus(
	status: string | null | undefined,
): boolean {
	return TERMINAL_SHOOT_STATUSES.has(normalizeShootStatus(status));
}

export function getCalendarDeleteJobType(
	deliveryMethod: "google" | "ics" | "unsendable",
): "google_delete" | "ics_send_cancel" | null {
	if (deliveryMethod === "unsendable") {
		return null;
	}
	return deliveryMethod === "ics" ? "ics_send_cancel" : "google_delete";
}
