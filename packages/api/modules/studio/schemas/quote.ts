import { z } from "zod";
import {
	bookingParticipantInputSchema,
	createBookingInputSchema,
	deliverableInputSchema,
	paymentScheduleInputSchema,
	shootCrewAssignmentInputSchema,
	shootInputSchema,
} from "./booking";
import {
	idInputSchema,
	idSchema,
	lineItemTypeSchema,
	moneySchema,
	paginationResponseSchema,
	paginationSchema,
	sortDirectionSchema,
} from "./common";
import {
	bookingBlueprintV2Schema,
	quotationBrandingSnapshotV1Schema,
	quotationDocumentV1Schema,
	quotationPdfSnapshotV1Schema,
} from "./quotation-document";

export const BOOKING_BLUEPRINT_VERSION_V1 = 1 as const;

export const quoteStatusSchema = z.enum([
	"draft",
	"sent",
	"accepted",
	"converted",
	"declined",
	"expired",
	"superseded",
]);
export type QuoteStatus = z.infer<typeof quoteStatusSchema>;

export const currencyCodeSchema = z
	.string()
	.regex(/^[A-Z]{3}$/, "Must be an uppercase ISO 4217 currency code");

function decimalToScaledInteger(value: string, scale: number): bigint {
	const [whole = "0", fraction = ""] = value.split(".");
	return BigInt(`${whole}${fraction.padEnd(scale, "0")}`);
}

const MAX_NUMERIC_12_2_CENTS = BigInt("999999999999");
const MAX_NUMERIC_10_2_CENTS = BigInt("9999999999");

export const quotationMoneySchema = moneySchema.refine(
	(value) => decimalToScaledInteger(value, 2) <= MAX_NUMERIC_12_2_CENTS,
	"Must not exceed 9999999999.99",
);

export const bookingBlueprintOperationalMoneySchema = moneySchema.refine(
	(value) => decimalToScaledInteger(value, 2) <= MAX_NUMERIC_10_2_CENTS,
	"Must not exceed 99999999.99",
);

const optionalOperationalMoneySchema = z
	.union([
		bookingBlueprintOperationalMoneySchema,
		z.literal("").transform(() => undefined),
	])
	.optional();
const quotationShootCrewAssignmentInputSchema =
	shootCrewAssignmentInputSchema.extend({
		rate: optionalOperationalMoneySchema,
	});
const quotationShootInputSchema = shootInputSchema.extend({
	crewAssignments: z
		.array(quotationShootCrewAssignmentInputSchema)
		.optional(),
});
const quotationDeliverableInputSchema = deliverableInputSchema.extend({
	cost: bookingBlueprintOperationalMoneySchema.optional(),
});
const quotationPaymentScheduleSchema = paymentScheduleInputSchema.extend({
	amount: quotationMoneySchema,
	sortOrder: z.number().int().min(0),
});
const quotationPaymentScheduleInputSchema = quotationPaymentScheduleSchema.omit(
	{ sortOrder: true },
);

const bookingBlueprintPayloadBaseSchema = createBookingInputSchema
	.omit({ participants: true, packageCost: true, receivedPayments: true })
	.extend({
		shoots: z.array(quotationShootInputSchema).optional(),
		deliverables: z.array(quotationDeliverableInputSchema).optional(),
	});
const bookingBlueprintPayloadV1InputSchema =
	bookingBlueprintPayloadBaseSchema.extend({
		paymentSchedules: z
			.array(quotationPaymentScheduleInputSchema)
			.optional(),
	});
const bookingBlueprintPayloadV1Schema =
	bookingBlueprintPayloadBaseSchema.extend({
		paymentSchedules: z.array(quotationPaymentScheduleSchema).optional(),
	});

export const bookingBlueprintV1InputSchema = z.object({
	schemaVersion: z.literal(BOOKING_BLUEPRINT_VERSION_V1),
	booking: bookingBlueprintPayloadV1InputSchema,
});
export const bookingBlueprintInputSchema = z.discriminatedUnion(
	"schemaVersion",
	[bookingBlueprintV1InputSchema],
);
export const bookingBlueprintV1Schema = z.object({
	schemaVersion: z.literal(BOOKING_BLUEPRINT_VERSION_V1),
	booking: bookingBlueprintPayloadV1Schema,
});
export type BookingBlueprintV1 = z.infer<typeof bookingBlueprintV1Schema>;
export const bookingBlueprintSchema = z.discriminatedUnion("schemaVersion", [
	bookingBlueprintV1Schema,
	bookingBlueprintV2Schema,
]);
export type BookingBlueprint = z.infer<typeof bookingBlueprintSchema>;

export function assembleBookingInputFromBlueprintV1({
	blueprint,
	participants,
	packageCost,
}: {
	blueprint: BookingBlueprintV1;
	participants: z.infer<typeof bookingParticipantInputSchema>[];
	packageCost: string;
}): z.infer<typeof createBookingInputSchema> {
	return createBookingInputSchema.parse({
		...blueprint.booking,
		participants,
		packageCost: quotationMoneySchema.parse(packageCost),
	});
}

const decimalQuantitySchema = z
	.string()
	.regex(/^\d+(\.\d{1,2})?$/, "Must have at most 2 decimal places")
	.refine(
		(value) => decimalToScaledInteger(value, 2) > BigInt(0),
		"Must be greater than zero",
	)
	.refine(
		(value) => decimalToScaledInteger(value, 2) <= MAX_NUMERIC_10_2_CENTS,
		"Must not exceed 99999999.99",
	);

/** Caller-owned line content. Item/service amounts are always server-derived. */
const itemizedQuoteLineInputSchema = z.object({
	type: z.enum(["item", "service"]).default("item"),
	description: z.string().min(1).max(500),
	quantity: decimalQuantitySchema,
	unitPrice: quotationMoneySchema,
});
const lumpSumQuoteLineInputSchema = z.object({
	type: z.enum(["milestone", "expense"]),
	description: z.string().min(1).max(500),
	amount: quotationMoneySchema,
});
export const quoteLineItemInputSchema = z.union([
	itemizedQuoteLineInputSchema,
	lumpSumQuoteLineInputSchema,
]);
export type QuoteLineItemInput = z.infer<typeof quoteLineItemInputSchema>;

/** Caller totals and sort orders are intentionally absent and therefore stripped. */
export const quoteOptionInputSchema = z.object({
	name: z.string().min(1).max(255),
	description: z.string().max(2000).optional(),
	discountAmount: quotationMoneySchema.default("0"),
	taxAmount: quotationMoneySchema.default("0"),
	bookingBlueprint: bookingBlueprintInputSchema,
	isRecommended: z.boolean().default(false),
	lineItems: z.array(quoteLineItemInputSchema).min(1),
});
export type QuoteOptionInput = z.infer<typeof quoteOptionInputSchema>;

export const quoteParticipantInputSchema = bookingParticipantInputSchema.extend(
	{
		side: z.string().min(1).max(50).optional(),
		isPrimary: z.boolean().default(false),
	},
);
export type QuoteParticipantInput = z.infer<typeof quoteParticipantInputSchema>;

export const quoteDraftContentInputSchema = z
	.object({
		title: z.string().min(1).max(255),
		currency: currencyCodeSchema.default("INR"),
		expiresAt: z.string().datetime().optional(),
		terms: z.array(z.string().min(1).max(5000)).optional(),
		clientMessage: z.string().max(5000).optional(),
		internalNotes: z.string().max(5000).optional(),
		participants: z.array(quoteParticipantInputSchema).min(1),
		options: z.array(quoteOptionInputSchema).min(1),
	})
	.superRefine((draft, ctx) => {
		if (draft.participants.filter((item) => item.isPrimary).length > 1) {
			ctx.addIssue({
				code: "custom",
				path: ["participants"],
				message: "At most one participant can be primary",
			});
		}
		if (draft.options.filter((item) => item.isRecommended).length > 1) {
			ctx.addIssue({
				code: "custom",
				path: ["options"],
				message: "At most one option can be recommended",
			});
		}
	});
export type QuoteDraftContentInput = z.infer<
	typeof quoteDraftContentInputSchema
>;

export const normalizedQuoteLineItemSchema = z.object({
	type: lineItemTypeSchema,
	description: z.string().min(1).max(500),
	quantity: decimalQuantitySchema.optional(),
	unitPrice: quotationMoneySchema.optional(),
	amount: quotationMoneySchema,
	sortOrder: z.number().int().min(0),
});
export const normalizedQuoteOptionSchema = quoteOptionInputSchema.extend({
	bookingBlueprint: bookingBlueprintSchema,
	subtotal: quotationMoneySchema,
	totalAmount: quotationMoneySchema,
	sortOrder: z.number().int().min(0),
	lineItems: z.array(normalizedQuoteLineItemSchema).min(1),
});
export type NormalizedQuoteOption = z.infer<typeof normalizedQuoteOptionSchema>;

export const acceptedQuoteOptionSnapshotSchema = z.object({
	quoteId: idSchema,
	quoteOptionId: idSchema,
	quoteNumber: z.string().min(1).max(50),
	quoteVersion: z.number().int().positive(),
	currency: currencyCodeSchema,
	acceptedAt: z.string().datetime(),
	option: normalizedQuoteOptionSchema,
});
export type AcceptedQuoteOptionSnapshot = z.infer<
	typeof acceptedQuoteOptionSnapshotSchema
>;

const nullableDatetimeSchema = z.string().datetime().nullable();
const quoteParticipantOutputSchema = z.object({
	id: idSchema,
	clientId: idSchema,
	role: z.string(),
	side: z.string().nullable(),
	isPrimary: z.boolean(),
	sortOrder: z.number().int(),
	client: z.object({
		id: idSchema,
		name: z.string(),
		email: z.string().nullable(),
		phoneNumber: z.string().nullable(),
	}),
});
const quoteOptionOutputSchema = normalizedQuoteOptionSchema.extend({
	id: idSchema,
});
export const quoteSummarySchema = z.object({
	id: idSchema,
	quoteNumber: z.string(),
	version: z.number().int(),
	status: quoteStatusSchema,
	title: z.string(),
	currency: currencyCodeSchema,
	expiresAt: nullableDatetimeSchema,
	createdAt: z.string().datetime(),
	updatedAt: z.string().datetime(),
	deletedAt: nullableDatetimeSchema,
	primaryClient: z.object({ id: idSchema, name: z.string() }).nullable(),
	optionCount: z.number().int(),
	minTotalAmount: quotationMoneySchema.nullable(),
	maxTotalAmount: quotationMoneySchema.nullable(),
});
export type QuoteSummary = z.infer<typeof quoteSummarySchema>;

export const quoteDetailSchema = quoteSummarySchema.extend({
	supersedesQuoteId: idSchema.nullable(),
	terms: z.array(z.string()).nullable(),
	clientMessage: z.string().nullable(),
	internalNotes: z.string().nullable(),
	documentVersion: z.number().int().positive().nullable(),
	document: quotationDocumentV1Schema.nullable(),
	documentSha256: z.string().length(64).nullable(),
	documentRevision: z.number().int().nonnegative(),
	brandingSnapshot: quotationBrandingSnapshotV1Schema.nullable(),
	pdfSnapshot: quotationPdfSnapshotV1Schema.nullable(),
	sentAt: nullableDatetimeSchema,
	convertedAt: nullableDatetimeSchema,
	declinedAt: nullableDatetimeSchema,
	expiredAt: nullableDatetimeSchema,
	supersededAt: nullableDatetimeSchema,
	participants: z.array(quoteParticipantOutputSchema),
	options: z.array(quoteOptionOutputSchema),
	acceptance: z
		.object({
			quoteOptionId: idSchema,
			acceptedAt: z.string().datetime(),
			acceptedBy: idSchema.nullable(),
			optionSnapshot: acceptedQuoteOptionSnapshotSchema,
		})
		.nullable(),
	convertedBooking: z
		.object({
			id: idSchema,
			referenceNumber: z.string(),
			status: z.string(),
			deletedAt: nullableDatetimeSchema,
		})
		.nullable(),
});

export type QuoteDetail = z.infer<typeof quoteDetailSchema>;

export const listQuotesInputSchema = paginationSchema.extend({
	search: z.string().trim().max(255).optional(),
	statuses: z.array(quoteStatusSchema).optional(),
	documentVersion: z.literal(1).optional(),
	clientId: idSchema.optional(),
	includeDeleted: z.boolean().default(false),
	sortBy: z
		.enum([
			"createdAt",
			"updatedAt",
			"quoteNumber",
			"title",
			"status",
			"expiresAt",
		])
		.default("createdAt"),
	sortDirection: sortDirectionSchema,
});
export const listQuotesOutputSchema = z.object({
	data: z.array(quoteSummarySchema),
	pagination: paginationResponseSchema,
});
export const getQuoteInputSchema = idInputSchema;
export const getQuoteOutputSchema = z.object({ data: quoteDetailSchema });
export const createQuoteInputSchema = quoteDraftContentInputSchema;
export const updateQuoteInputSchema = idInputSchema.extend({
	content: quoteDraftContentInputSchema,
});
export const quoteMutationOutputSchema = z.object({
	data: z.object({ id: idSchema }),
	message: z.string(),
});
export const reviseQuoteInputSchema = idInputSchema;
export const reviseQuoteOutputSchema = z.object({
	data: z.object({
		id: idSchema,
		quoteNumber: z.string(),
		version: z.number().int(),
	}),
	message: z.string(),
});
export const acceptQuoteInputSchema = idInputSchema.extend({
	quoteOptionId: idSchema,
});
export const convertQuoteOutputSchema = z.object({
	data: z.object({
		id: idSchema,
		referenceNumber: z.string(),
		status: z.string(),
		deletedAt: nullableDatetimeSchema,
	}),
	message: z.string(),
});

export const createDocumentQuoteInputSchema = z.object({
	document: quotationDocumentV1Schema,
});
export const saveDocumentQuoteInputSchema = idInputSchema.extend({
	expectedDocumentRevision: z.number().int().nonnegative(),
	document: quotationDocumentV1Schema,
});
export const sendDocumentQuoteInputSchema = idInputSchema.extend({
	expectedDocumentRevision: z.number().int().positive(),
});
export const documentQuoteMutationOutputSchema = z.object({
	data: z.object({
		id: idSchema,
		documentRevision: z.number().int().positive(),
		document: quotationDocumentV1Schema,
		reused: z.boolean(),
	}),
	message: z.string(),
});
export const searchQuotationContactsInputSchema = z.object({
	query: z.string().trim().min(1).max(255),
	limit: z.number().int().min(1).max(20).default(20),
});
export const quotationContactSearchResultSchema = z.object({
	id: idSchema,
	lifecycleStage: z.enum(["lead", "client"]),
	name: z.string(),
	email: z.string().nullable(),
	phoneNumber: z.string().nullable(),
	alternatePhone: z.string().nullable(),
	address: z.string().nullable(),
	metadata: z.record(z.string(), z.unknown()).nullable(),
	updatedAt: z.string().datetime(),
});
export const searchQuotationContactsOutputSchema = z.object({
	data: z.object({
		leads: z.array(quotationContactSearchResultSchema),
		clients: z.array(quotationContactSearchResultSchema),
	}),
});
