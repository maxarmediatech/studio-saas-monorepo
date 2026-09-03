import type { EventSide } from "../../studio/schemas/quotation-document";

export const QUOTATION_EVENT_SIDE_LABELS: Record<EventSide, string> = {
	common: "Common",
	bride: "Bride side",
	groom: "Groom side",
	both: "Both sides",
	separateCommon: "Separate common",
};

export function formatQuotationMoney(value: string): string {
	const [integer = "0", fraction = ""] = value.split(".");
	const grouped = new Intl.NumberFormat("en-IN", {
		maximumFractionDigits: 0,
	}).format(BigInt(integer));
	return `INR ${grouped}.${fraction.padEnd(2, "0").slice(0, 2)}`;
}

export function formatQuotationDate(
	value: string | null,
	notScheduled = "Not scheduled",
): string {
	if (!value) {
		return notScheduled;
	}
	return new Intl.DateTimeFormat("en-IN", {
		day: "numeric",
		month: "short",
		year: "numeric",
		timeZone: "UTC",
	}).format(new Date(`${value.slice(0, 10)}T00:00:00Z`));
}

export function formatQuotationValidUntil(
	value: string | null,
	timeZone: string,
	notScheduled = "Not scheduled",
): string {
	if (!value) {
		return notScheduled;
	}
	return new Intl.DateTimeFormat("en-IN", {
		day: "numeric",
		month: "short",
		year: "numeric",
		timeZone,
	}).format(new Date(value));
}
