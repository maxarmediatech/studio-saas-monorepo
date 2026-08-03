import type { QuoteStatus } from "../../studio/schemas/quote";

export type QuoteCommand =
	| "edit"
	| "delete"
	| "send"
	| "revise"
	| "accept"
	| "decline"
	| "expire"
	| "convert";

const allowedStatuses: Record<QuoteCommand, readonly QuoteStatus[]> = {
	edit: ["draft"],
	delete: ["draft"],
	send: ["draft"],
	revise: ["sent", "accepted", "declined", "expired"],
	accept: ["sent"],
	decline: ["sent"],
	expire: ["sent"],
	convert: ["accepted", "converted"],
};

export function canRunQuoteCommand(
	status: QuoteStatus,
	command: QuoteCommand,
): boolean {
	return allowedStatuses[command].includes(status);
}

export function isQuoteExpiryDue(
	expiresAt: Date | null,
	now = new Date(),
): boolean {
	return expiresAt !== null && expiresAt <= now;
}
