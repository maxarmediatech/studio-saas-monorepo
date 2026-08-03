import {
	CalendarDaysIcon,
	CheckCircleIcon,
	FileTextIcon,
	type LucideIcon,
	PackageIcon,
	UsersIcon,
} from "lucide-react";

export type QuotationStepId =
	| "client"
	| "events"
	| "packages"
	| "terms"
	| "preview";

export type EventSide =
	| "common"
	| "bride"
	| "groom"
	| "both"
	| "separateCommon";

export type QuotationEvent = {
	id: string;
	eventTypeId: string | null;
	eventTypeKey: string | null;
	date: string;
	side: EventSide;
	name: string;
	location: string;
	guestCount: string;
	tentative: boolean;
	notes: string;
};

export type CrewCoverage = {
	id: string;
	eventId: string;
	eventName: string;
	side: EventSide;
	roles: string;
};

export type PackageOption = {
	id: string;
	configurationId: string | null;
	configurationKey: string | null;
	configurationDefaultCost: string | null;
	configurationDescription: string | null;
	name: string;
	price: string;
	summary: string;
	coverage: CrewCoverage[];
	deliverables: QuotationDeliverable[];
};

export type QuotationDeliverable = {
	id: string;
	name: string;
	quantity: string;
	details: string;
};

export type PaymentMilestone = {
	id: string;
	label: string;
	percent: string;
	timing: string;
};

export type QuotationClient = {
	id: string;
	clientId: string | null;
	clientUpdatedAt: string | null;
	name: string;
	email: string;
	phoneNumber: string;
	alternatePhone: string;
	address: string;
	profession: string;
	source: string;
	socialHandle: string;
	notes: string;
};

export type QuotationDraft = {
	title: string;
	quoteDate: string;
	quotationType: string;
	quotationTypeId: string | null;
	quotationTypeKey: string | null;
	validUntil: string;
	weddingWindow: string;
	notes: string;
	clients: QuotationClient[];
	selectedPackageId: string;
	events: QuotationEvent[];
	packages: PackageOption[];
	timelines: string[];
	timelineKeys: string[];
	terms: string[];
	termKeys: string[];
	payments: PaymentMilestone[];
};

export type QuotationStepConfig = {
	id: QuotationStepId;
	label: string;
	description: string;
	icon: LucideIcon;
};

export const QUOTATION_STEPS: QuotationStepConfig[] = [
	{
		id: "client",
		label: "Clients",
		description: "Lead contact details",
		icon: UsersIcon,
	},
	{
		id: "events",
		label: "Details",
		description: "Quote info, functions and venues",
		icon: CalendarDaysIcon,
	},
	{
		id: "packages",
		label: "Packages",
		description: "Options, coverage and outputs",
		icon: PackageIcon,
	},
	{
		id: "terms",
		label: "Terms",
		description: "Payments, exclusions and clauses",
		icon: FileTextIcon,
	},
	{
		id: "preview",
		label: "Preview",
		description: "Document check before sending",
		icon: CheckCircleIcon,
	},
];

export function buildQuotationTitle(draft: QuotationDraft): string {
	const clientNames = draft.clients
		.map((client) => client.name.trim())
		.filter(Boolean)
		.join(" and ");
	const quotationType = draft.quotationType.trim() || "Quotation";
	return clientNames
		? `${clientNames} - ${quotationType} quotation`
		: `${quotationType} quotation`;
}

export function updateQuotationClientField(
	client: QuotationClient,
	key: keyof QuotationClient,
	value: string,
): QuotationClient {
	return {
		...client,
		[key]: value,
	};
}

export function createLeadFromQuotationClient(
	client: QuotationClient,
	name: string,
): QuotationClient {
	return {
		...client,
		name,
		clientId: null,
		clientUpdatedAt: null,
	};
}

export function createDraftId(prefix: string) {
	return `${prefix}-${crypto.randomUUID()}`;
}

export function createDefaultQuotationDraft(
	quotationDate = "",
): QuotationDraft {
	const participantId = createDraftId("client");
	const eventId = createDraftId("event");
	const packageId = createDraftId("package");
	return {
		title: "",
		quoteDate: quotationDate,
		quotationType: "",
		quotationTypeId: null,
		quotationTypeKey: null,
		validUntil: "",
		weddingWindow: "",
		notes: "",
		clients: [
			{
				id: participantId,
				clientId: null,
				clientUpdatedAt: null,
				name: "",
				email: "",
				phoneNumber: "",
				alternatePhone: "",
				address: "",
				profession: "",
				source: "",
				socialHandle: "",
				notes: "",
			},
		],
		selectedPackageId: packageId,
		events: [
			{
				id: eventId,
				eventTypeId: null,
				eventTypeKey: null,
				date: "",
				side: "common",
				name: "",
				location: "",
				guestCount: "",
				tentative: true,
				notes: "",
			},
		],
		packages: [
			{
				id: packageId,
				configurationId: null,
				configurationKey: null,
				configurationDefaultCost: null,
				configurationDescription: null,
				name: "",
				price: "",
				summary: "",
				coverage: [],
				deliverables: [],
			},
		],
		timelines: [],
		timelineKeys: [],
		terms: [],
		termKeys: [],
		payments: [
			{
				id: "advance",
				label: "Advance",
				percent: "40",
				timing: "Booking confirmation and team allotment",
			},
			{
				id: "raw-data",
				label: "Second installment",
				percent: "50",
				timing: "At the time of raw data transfer",
			},
			{
				id: "delivery",
				label: "Final installment",
				percent: "10",
				timing: "At the time of delivery",
			},
		],
	};
}
