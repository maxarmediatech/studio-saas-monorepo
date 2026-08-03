import type { QuoteDraftContentInput } from "@repo/api/modules/studio/schemas/quote";

export type OptionDraft = QuoteDraftContentInput["options"][number];
export type BookingDraft = OptionDraft["bookingBlueprint"]["booking"];
export type EditorStep =
	| "proposal"
	| "pricing"
	| "booking"
	| "operations"
	| "review";
export type EditorErrors = Record<string, string>;
export type ConfigurationOption = { key: string; label: string };
export type ClientOption = { id: string; name: string };
export type CrewOption = { id: string; name: string };

export const EDITOR_STEPS: Array<{ id: EditorStep; label: string }> = [
	{ id: "proposal", label: "Proposal" },
	{ id: "pricing", label: "Pricing" },
	{ id: "booking", label: "Booking" },
	{ id: "operations", label: "Operations" },
	{ id: "review", label: "Review" },
];
