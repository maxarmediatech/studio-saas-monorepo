import type { contactItemSchema } from "@repo/api/modules/whatsapp/types";
import type { z } from "zod";

export type WhatsAppContact = z.infer<typeof contactItemSchema>;
export type LinkType = "all" | "linked" | "unlinked" | "client" | "crew";
export type FlagFilter = "all" | "yes" | "no";

export const ALL_FILTER_VALUE = "all";

export function displayName(contact: WhatsAppContact) {
	return (
		contact.name || contact.pushName || contact.phoneNumber || contact.waId
	);
}

export function formatDate(value: Date | null) {
	if (!value) {
		return "No messages yet";
	}

	return new Intl.DateTimeFormat(undefined, {
		month: "short",
		day: "numeric",
		hour: "numeric",
		minute: "2-digit",
	}).format(value);
}

export function getLinkLabel(contact: WhatsAppContact) {
	if (!contact.externalId) {
		return "Unlinked";
	}

	if (contact.externalSource === "client") {
		return "Client";
	}

	if (contact.externalSource === "crew") {
		return "Crew";
	}

	return contact.externalSource ?? "Linked";
}

function flagValue(value: FlagFilter) {
	if (value === "yes") {
		return true;
	}

	if (value === "no") {
		return false;
	}

	return undefined;
}

export function buildContactsInput({
	search,
	tag,
	linkType,
	blocked,
	optedOut,
}: {
	search: string;
	tag: string;
	linkType: LinkType;
	blocked: FlagFilter;
	optedOut: FlagFilter;
}) {
	return {
		limit: 50,
		...(search.trim() ? { search: search.trim() } : {}),
		...(tag !== ALL_FILTER_VALUE ? { tag } : {}),
		...(linkType !== ALL_FILTER_VALUE ? { linkType } : {}),
		...(flagValue(blocked) !== undefined
			? { blocked: flagValue(blocked) }
			: {}),
		...(flagValue(optedOut) !== undefined
			? { optedOut: flagValue(optedOut) }
			: {}),
	};
}
