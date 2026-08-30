import type {
	QuoteDetail,
	QuoteDraftContentInput,
	QuoteStatus,
	QuoteSummary,
} from "@repo/api/modules/studio/schemas/quote";

export const QUOTE_STATUSES: QuoteStatus[] = [
	"sent",
	"accepted",
	"converted",
	"declined",
	"expired",
	"superseded",
];

export const QUOTE_SORT_FIELDS = [
	"createdAt",
	"updatedAt",
	"quoteNumber",
	"title",
	"status",
	"expiresAt",
] as const;
export type QuoteSortField = (typeof QUOTE_SORT_FIELDS)[number];
export type QuoteSortDirection = "asc" | "desc";

const UUID_PATTERN =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type QuotationListParams = {
	page: number;
	status: QuoteStatus | "all";
	clientId: string | "all";
	sortBy: QuoteSortField;
	sortDirection: QuoteSortDirection;
};

export function normalizeQuotationListParams(
	params: Pick<URLSearchParams, "get">,
): QuotationListParams {
	const rawPage = params.get("page");
	const parsedPage = rawPage && /^\d+$/.test(rawPage) ? Number(rawPage) : 1;
	const rawStatus = params.get("status");
	const status = QUOTE_STATUSES.some((item) => item === rawStatus)
		? (rawStatus as QuoteStatus)
		: "all";
	const rawClient = params.get("client");
	const clientId =
		rawClient && UUID_PATTERN.test(rawClient) ? rawClient : "all";
	const legacySort = params.get("sort")?.split(":") ?? [];
	const rawSortBy = legacySort[0] ?? params.get("sortBy");
	const rawDirection = legacySort[1] ?? params.get("direction");
	const sortBy = QUOTE_SORT_FIELDS.some((item) => item === rawSortBy)
		? (rawSortBy as QuoteSortField)
		: "createdAt";
	const sortDirection =
		rawDirection === "asc" || rawDirection === "desc"
			? rawDirection
			: "desc";

	return {
		page:
			Number.isSafeInteger(parsedPage) && parsedPage >= 1
				? parsedPage
				: 1,
		status,
		clientId,
		sortBy,
		sortDirection,
	};
}

export const QUOTE_STATUS_LABELS: Record<QuoteStatus, string> = {
	draft: "Draft",
	sent: "Sent",
	accepted: "Accepted",
	converted: "Converted",
	declined: "Declined",
	expired: "Expired",
	superseded: "Superseded",
};

const REVISION_STATUSES = new Set<QuoteStatus>([
	"sent",
	"accepted",
	"declined",
	"expired",
]);

export type QuotePresentationCapabilities = {
	readOperational: boolean;
	create: boolean;
	update: boolean;
	send: boolean;
	revise: boolean;
	accept: boolean;
	decline: boolean;
	expire: boolean;
	convert: boolean;
};

export type QuoteAction =
	| "edit"
	| "send"
	| "revise"
	| "accept"
	| "decline"
	| "expire"
	| "convert";

export function getQuoteActions(
	quote: Pick<QuoteSummary, "status" | "expiresAt">,
	caps: QuotePresentationCapabilities,
	now = new Date(),
): QuoteAction[] {
	const actions: QuoteAction[] = [];
	const expiryDue = Boolean(
		quote.expiresAt && new Date(quote.expiresAt).getTime() <= now.getTime(),
	);
	if (quote.status === "draft") {
		if (caps.readOperational && caps.update) {
			actions.push("edit");
		}
		if (caps.send && !expiryDue) {
			actions.push("send");
		}
	}
	if (REVISION_STATUSES.has(quote.status) && caps.revise) {
		actions.push("revise");
	}
	if (quote.status === "sent") {
		if (caps.accept && !expiryDue) {
			actions.push("accept");
		}
		if (caps.decline) {
			actions.push("decline");
		}
		if (caps.expire && expiryDue) {
			actions.push("expire");
		}
	}
	if (quote.status === "accepted" && caps.convert) {
		actions.push("convert");
	}
	return actions;
}

export function formatQuoteTotal(summary: QuoteSummary): string | null {
	if (!summary.minTotalAmount || !summary.maxTotalAmount) {
		return null;
	}
	const formatter = new Intl.NumberFormat("en-IN", {
		style: "currency",
		currency: summary.currency,
		maximumFractionDigits: 2,
	});
	if (summary.minTotalAmount === summary.maxTotalAmount) {
		return formatter.format(Number(summary.minTotalAmount));
	}
	return `${formatter.format(Number(summary.minTotalAmount))} – ${formatter.format(Number(summary.maxTotalAmount))}`;
}

function localDate(): string {
	const now = new Date();
	return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

export function createEmptyQuoteDraft(): QuoteDraftContentInput {
	return {
		title: "",
		currency: "INR",
		participants: [{ clientId: "", role: "", isPrimary: true }],
		terms: [],
		options: [createEmptyOption()],
	};
}

export function createEmptyOption(): QuoteDraftContentInput["options"][number] {
	return {
		name: "",
		description: "",
		discountAmount: "0.00",
		taxAmount: "0.00",
		isRecommended: false,
		lineItems: [
			{
				type: "service",
				description: "",
				quantity: "1",
				unitPrice: "0.00",
			},
		],
		bookingBlueprint: {
			schemaVersion: 1,
			booking: {
				name: "",
				bookingDate: localDate(),
				bookingType: "",
				packageType: "",
				note: "",
				events: [],
				shoots: [],
				deliverables: [],
				paymentSchedules: [],
			},
		},
	};
}

export function quoteDetailToDraft(
	detail: QuoteDetail,
): QuoteDraftContentInput {
	if (
		detail.options.some(
			(option) => option.bookingBlueprint.schemaVersion !== 1,
		)
	) {
		throw new Error(
			"Document quotations must be edited through the quotation wizard",
		);
	}
	return {
		title: detail.title,
		currency: detail.currency,
		expiresAt: detail.expiresAt ?? undefined,
		terms: detail.terms ?? undefined,
		clientMessage: detail.clientMessage ?? undefined,
		internalNotes: detail.internalNotes ?? undefined,
		participants: detail.participants.map((participant) => ({
			clientId: participant.clientId,
			role: participant.role,
			side: participant.side ?? undefined,
			isPrimary: participant.isPrimary,
		})),
		options: detail.options.map((option) => {
			if (option.bookingBlueprint.schemaVersion !== 1) {
				throw new Error("Unexpected document quotation blueprint");
			}
			return {
				name: option.name,
				description: option.description,
				discountAmount: option.discountAmount,
				taxAmount: option.taxAmount,
				bookingBlueprint: {
					...option.bookingBlueprint,
					booking: {
						...option.bookingBlueprint.booking,
						paymentSchedules:
							option.bookingBlueprint.booking.paymentSchedules?.map(
								({ sortOrder: _sortOrder, ...schedule }) =>
									schedule,
							),
					},
				},
				isRecommended: option.isRecommended,
				lineItems: option.lineItems.map((line) =>
					line.type === "item" || line.type === "service"
						? {
								type: line.type,
								description: line.description,
								quantity: line.quantity ?? "1",
								unitPrice: line.unitPrice ?? "0.00",
							}
						: {
								type: line.type,
								description: line.description,
								amount: line.amount,
							},
				),
			};
		}),
	};
}

export function optionTotal(
	option: QuoteDraftContentInput["options"][number],
): number {
	const cents = optionTotalCents(option);
	return cents === null ? Number.NaN : Number(cents) / 100;
}

function decimalToCents(value: string | undefined): bigint | null {
	if (!value || !/^\d+(\.\d{1,2})?$/.test(value)) {
		return null;
	}
	const [whole = "0", fraction = ""] = value.split(".");
	return BigInt(whole) * BigInt(100) + BigInt(fraction.padEnd(2, "0"));
}

export function optionSubtotalCents(
	option: QuoteDraftContentInput["options"][number],
): bigint | null {
	let subtotal = BigInt(0);
	for (const line of option.lineItems) {
		if (line.type === "item" || line.type === "service") {
			const quantity = decimalToCents(line.quantity);
			const unitPrice = decimalToCents(line.unitPrice);
			if (quantity === null || unitPrice === null) {
				return null;
			}
			subtotal += (quantity * unitPrice + BigInt(50)) / BigInt(100);
		} else if (line.type === "milestone" || line.type === "expense") {
			const amount = decimalToCents(line.amount);
			if (amount === null) {
				return null;
			}
			subtotal += amount;
		}
	}
	return subtotal;
}

export function optionTotalCents(
	option: QuoteDraftContentInput["options"][number],
): bigint | null {
	const subtotal = optionSubtotalCents(option);
	if (subtotal === null) {
		return null;
	}
	const discount = decimalToCents(option.discountAmount);
	const tax = decimalToCents(option.taxAmount);
	if (discount === null || tax === null) {
		return null;
	}
	if (discount > subtotal) {
		return null;
	}
	return subtotal - discount + tax;
}

export function hasExcessiveDiscount(
	option: QuoteDraftContentInput["options"][number],
): boolean {
	const subtotal = optionSubtotalCents(option);
	const discount = decimalToCents(option.discountAmount);
	return subtotal !== null && discount !== null && discount > subtotal;
}

export function paymentSchedulesMatchOptionTotal(
	option: QuoteDraftContentInput["options"][number],
): boolean {
	const schedules = option.bookingBlueprint.booking.paymentSchedules ?? [];
	if (schedules.length === 0) {
		return true;
	}
	const total = optionTotalCents(option);
	if (total === null) {
		return false;
	}
	let scheduled = BigInt(0);
	for (const item of schedules) {
		const amount = decimalToCents(item.amount);
		if (amount === null) {
			return false;
		}
		scheduled += amount;
	}
	return scheduled === total;
}

export function attachmentKeysToDelete({
	initialKeys,
	currentKeys,
	uploadedKeys,
	includeInitial,
}: {
	initialKeys: Iterable<string>;
	currentKeys: Iterable<string>;
	uploadedKeys: Iterable<string>;
	includeInitial: boolean;
}): string[] {
	const keys = new Set(uploadedKeys);
	if (includeInitial) {
		for (const key of initialKeys) {
			keys.add(key);
		}
	}
	for (const key of currentKeys) {
		keys.delete(key);
	}
	return [...keys];
}

export function shouldGuardSpaNavigation(current: URL, target: URL): boolean {
	if (target.origin !== current.origin || target.href === current.href) {
		return false;
	}
	if (
		target.pathname === current.pathname &&
		target.search === current.search &&
		target.hash
	) {
		return false;
	}
	return true;
}

export type EditorErrorTarget = {
	key: string;
	step: "proposal" | "pricing" | "booking" | "operations";
	controlId: string;
	optionIndex?: number;
};

export function getEditorErrorTarget(path: PropertyKey[]): EditorErrorTarget {
	const key = path.map(String).join(".");
	if (path[0] !== "options") {
		if (path[0] === "participants") {
			return {
				key: "participants",
				step: "proposal",
				controlId: "quotation-participants",
			};
		}
		if (path[0] === "terms") {
			return {
				key: "terms",
				step: "proposal",
				controlId: "quotation-terms",
			};
		}
		return {
			key,
			step: "proposal",
			controlId:
				path[0] === "expiresAt"
					? "quotation-expiry"
					: `quotation-${String(path[0] ?? "title")}`,
		};
	}
	const optionIndex = Number(path[1] ?? 0);
	const normalizedField = String(path[2] ?? "");
	if (
		["events", "shoots", "deliverables", "paymentSchedules"].includes(
			normalizedField,
		)
	) {
		return {
			key: `options.${optionIndex}.${normalizedField}`,
			step: "operations",
			controlId: `quotation-${normalizedField}`,
			optionIndex,
		};
	}
	if (normalizedField === "booking") {
		return {
			key: `options.${optionIndex}.booking`,
			step: "booking",
			controlId: "blueprint-booking-name",
			optionIndex,
		};
	}
	const bookingIndex = path.indexOf("booking");
	if (bookingIndex >= 0) {
		const field = String(path[bookingIndex + 1] ?? "name");
		const operations = new Set([
			"events",
			"shoots",
			"deliverables",
			"paymentSchedules",
		]);
		if (operations.has(field)) {
			return {
				key: `options.${optionIndex}.${field}`,
				step: "operations",
				controlId: `quotation-${field}`,
				optionIndex,
			};
		}
		return {
			key: `options.${optionIndex}.booking`,
			step: "booking",
			controlId: "blueprint-booking-name",
			optionIndex,
		};
	}
	const field = String(path[2] ?? "name");
	const mapped =
		field === "discountAmount" || field === "taxAmount" || field === "name"
			? field
			: "lineItems";
	return {
		key: `options.${optionIndex}.${mapped}`,
		step: "pricing",
		controlId: `quotation-option-${mapped.replace("Amount", "").toLowerCase()}`,
		optionIndex,
	};
}
