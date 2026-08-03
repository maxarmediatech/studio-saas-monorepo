import { z } from "zod";

export const QUOTATION_DOCUMENT_VERSION = 1 as const;
export const BOOKING_BLUEPRINT_VERSION_V2 = 2 as const;
export const QUOTATION_PDF_RENDERER_VERSION = "quotation-pdf-v1" as const;

export const eventSideSchema = z.enum([
	"common",
	"bride",
	"groom",
	"both",
	"separateCommon",
]);
export type EventSide = z.infer<typeof eventSideSchema>;

const keySchema = z.string().min(1).max(255);
const nullableText = (max: number) => z.string().max(max).nullable();
const snapshotSchema = z.object({
	id: z.string().max(255).nullable(),
	key: z.string().max(100).nullable(),
	label: z.string().max(255),
});

export const quotationContactSnapshotSchema = z.object({
	name: z.string().max(255),
	email: nullableText(320),
	phoneNumber: nullableText(255),
	alternatePhone: nullableText(255),
	address: nullableText(5000),
	profession: nullableText(255),
	source: nullableText(255),
	socialHandle: nullableText(255),
	notes: nullableText(5000),
});

const participantSchema = z.object({
	key: keySchema,
	clientId: z.string().max(255).nullable(),
	clientUpdatedAt: z.string().datetime().nullable(),
	contact: quotationContactSnapshotSchema,
});

const eventSchema = z.object({
	key: keySchema,
	eventType: snapshotSchema,
	side: eventSideSchema,
	guestCount: nullableText(255),
	timelineMode: z.enum(["fixed", "tentative"]),
	fixedDate: z.string().date().nullable(),
	dateWindow: nullableText(500),
	location: nullableText(500),
	notes: nullableText(2000),
});

const packageConfigurationSchema = snapshotSchema.extend({
	defaultCost: z
		.string()
		.regex(/^\d+(\.\d{1,2})?$/)
		.nullable(),
	description: nullableText(500),
});

const coverageSchema = z.object({
	key: keySchema,
	eventKey: keySchema,
	roles: nullableText(5000),
});

const deliverableSchema = z.object({
	key: keySchema,
	name: z.string().max(255),
	quantity: z.number().int().min(1).max(10_000),
	details: nullableText(5000),
});

const packageSchema = z.object({
	key: keySchema,
	configuration: packageConfigurationSchema.nullable(),
	name: z.string().max(255),
	price: z
		.string()
		.regex(/^\d+(\.\d{1,2})?$/)
		.nullable(),
	summary: nullableText(2000),
	coverage: z.array(coverageSchema).max(50),
	deliverables: z.array(deliverableSchema).max(100),
});

const clauseSchema = z.object({ key: keySchema, text: z.string().max(5000) });
const milestoneSchema = z.object({
	key: keySchema,
	label: z.string().max(255),
	percentage: z.string().regex(/^\d+(\.\d{1,2})?$/),
	timing: z.string().max(500),
});

export const quotationDocumentV1Schema = z.object({
	schemaVersion: z.literal(QUOTATION_DOCUMENT_VERSION),
	quotationDate: z.union([z.literal(""), z.string().date()]),
	quotationType: snapshotSchema,
	title: z.string().max(255),
	currency: z.literal("INR"),
	participants: z.array(participantSchema).max(10),
	events: z.array(eventSchema).max(50),
	packages: z.array(packageSchema).max(10),
	recommendedPackageKey: keySchema.nullable(),
	deliveryTimelines: z.array(clauseSchema).max(50),
	paymentMilestones: z.array(milestoneSchema).max(3),
	fixedTerms: z.array(clauseSchema).max(50),
});

function addIssue(
	ctx: z.RefinementCtx,
	path: PropertyKey[],
	message: string,
): void {
	ctx.addIssue({ code: "custom", path, message });
}

function requireUniqueKeys(
	values: Array<{ key: string }>,
	path: PropertyKey[],
	ctx: z.RefinementCtx,
): void {
	if (new Set(values.map(({ key }) => key)).size !== values.length) {
		addIssue(ctx, path, "Stable keys must be unique");
	}
}

export const strictQuotationDocumentV1Schema =
	quotationDocumentV1Schema.superRefine((document, ctx) => {
		if (!document.quotationDate) {
			addIssue(ctx, ["quotationDate"], "Quotation date is required");
		}
		if (document.participants.length === 0) {
			addIssue(ctx, ["participants"], "At least one client is required");
		}
		requireUniqueKeys(document.participants, ["participants"], ctx);
		const resolvedIds = document.participants.flatMap((participant) =>
			participant.clientId ? [participant.clientId] : [],
		);
		if (new Set(resolvedIds).size !== resolvedIds.length) {
			addIssue(ctx, ["participants"], "Clients must be distinct");
		}
		document.participants.forEach((participant, index) => {
			if (!participant.contact.name.trim()) {
				addIssue(
					ctx,
					["participants", index, "contact", "name"],
					"Name is required",
				);
			}
			if (!participant.clientId) {
				addIssue(
					ctx,
					["participants", index, "clientId"],
					"Client must be resolved",
				);
			}
		});
		if (!document.quotationType.label.trim()) {
			addIssue(
				ctx,
				["quotationType", "label"],
				"Quotation type is required",
			);
		}
		if (!document.title.trim()) {
			addIssue(ctx, ["title"], "Title is required");
		}
		if (document.events.length === 0) {
			addIssue(ctx, ["events"], "At least one event is required");
		}
		requireUniqueKeys(document.events, ["events"], ctx);
		const eventKeys = new Set(document.events.map(({ key }) => key));
		document.events.forEach((event, index) => {
			if (!event.eventType.label.trim()) {
				addIssue(
					ctx,
					["events", index, "eventType"],
					"Event type is required",
				);
			}
			if (
				event.timelineMode === "fixed" &&
				(!event.fixedDate || event.dateWindow)
			) {
				addIssue(
					ctx,
					["events", index, "fixedDate"],
					"Fixed events require a date only",
				);
			}
			if (
				event.timelineMode === "tentative" &&
				(event.fixedDate || !event.dateWindow?.trim())
			) {
				addIssue(
					ctx,
					["events", index, "dateWindow"],
					"Tentative events require a date window only",
				);
			}
		});
		if (document.packages.length === 0) {
			addIssue(ctx, ["packages"], "At least one package is required");
		}
		requireUniqueKeys(document.packages, ["packages"], ctx);
		document.packages.forEach((item, index) => {
			if (!item.name.trim()) {
				addIssue(
					ctx,
					["packages", index, "name"],
					"Package name is required",
				);
			}
			if (item.price === null) {
				addIssue(
					ctx,
					["packages", index, "price"],
					"Package price is required",
				);
			}
			requireUniqueKeys(
				item.coverage,
				["packages", index, "coverage"],
				ctx,
			);
			requireUniqueKeys(
				item.deliverables,
				["packages", index, "deliverables"],
				ctx,
			);
			for (const [coverageIndex, coverage] of item.coverage.entries()) {
				if (!eventKeys.has(coverage.eventKey)) {
					addIssue(
						ctx,
						[
							"packages",
							index,
							"coverage",
							coverageIndex,
							"eventKey",
						],
						"Coverage references an unknown event",
					);
				}
			}
			item.deliverables.forEach((deliverable, deliverableIndex) => {
				if (!deliverable.name.trim()) {
					addIssue(
						ctx,
						[
							"packages",
							index,
							"deliverables",
							deliverableIndex,
							"name",
						],
						"Deliverable name is required",
					);
				}
			});
		});
		if (
			document.recommendedPackageKey &&
			!document.packages.some(
				({ key }) => key === document.recommendedPackageKey,
			)
		) {
			addIssue(
				ctx,
				["recommendedPackageKey"],
				"Recommended package does not exist",
			);
		}
		if (document.paymentMilestones.length !== 3) {
			addIssue(
				ctx,
				["paymentMilestones"],
				"Exactly three payment rows are required",
			);
		}
		const positive = document.paymentMilestones.filter(
			({ percentage }) => Number(percentage) > 0,
		);
		if (
			positive.some(
				({ label, timing }) => !label.trim() || !timing.trim(),
			)
		) {
			addIssue(
				ctx,
				["paymentMilestones"],
				"Positive payment rows require label and timing",
			);
		}
		const totalBasisPoints = positive.reduce(
			(total, row) => total + Math.round(Number(row.percentage) * 100),
			0,
		);
		if (totalBasisPoints !== 10_000) {
			addIssue(
				ctx,
				["paymentMilestones"],
				"Positive payment percentages must total 100.00",
			);
		}
	});

export type QuotationDocumentV1 = z.infer<typeof quotationDocumentV1Schema>;

export const quotationBrandingSnapshotV1Schema = z.object({
	schemaVersion: z.literal(1),
	organizationName: z.string().min(1).max(255),
	address: nullableText(5000),
	email: nullableText(320),
	phone: nullableText(255),
	taxIdentifier: nullableText(255),
	timezone: z.string().min(1).max(255),
	logoStorageKey: z.string().max(2000).nullable(),
	logoMimeType: z.enum(["image/png", "image/jpeg"]).nullable(),
	logoSha256: z.string().length(64).nullable(),
});
export type QuotationBrandingSnapshotV1 = z.infer<
	typeof quotationBrandingSnapshotV1Schema
>;

export const quotationPdfSnapshotV1Schema = z.object({
	rendererVersion: z.string().min(1).max(100),
	storageKey: z.string().min(1).max(2000),
	sha256: z.string().length(64),
	renderedAt: z.string().datetime(),
	pageCount: z.number().int().positive(),
	byteSize: z
		.number()
		.int()
		.positive()
		.max(20 * 1024 * 1024),
	branding: quotationBrandingSnapshotV1Schema,
});
export type QuotationPdfSnapshotV1 = z.infer<
	typeof quotationPdfSnapshotV1Schema
>;

export const bookingBlueprintV2Schema = z.object({
	schemaVersion: z.literal(BOOKING_BLUEPRINT_VERSION_V2),
	sourceDocumentVersion: z.literal(QUOTATION_DOCUMENT_VERSION),
	optionKey: keySchema,
	booking: z.object({
		name: z.string().min(1).max(255),
		bookingDateStrategy: z.literal("acceptanceDateInOrganizationTimezone"),
		bookingType: z.string().min(1).max(255),
		packageType: z.string().min(1).max(255),
		events: z
			.array(
				z.object({
					documentKey: keySchema,
					eventType: z.string().min(1).max(255),
					side: eventSideSchema,
					guestCount: nullableText(255),
					isTentative: z.boolean(),
					eventDate: z.string().date().nullable(),
					dateWindow: nullableText(500),
					location: nullableText(500),
					notes: nullableText(2000),
					coverageNotes: nullableText(5000),
				}),
			)
			.max(50),
		deliverables: z
			.array(
				z.object({
					documentKey: keySchema,
					name: z.string().min(1).max(255),
					quantity: z.number().int().min(1).max(10_000),
					description: nullableText(5000),
					isPackageIncluded: z.literal(true),
				}),
			)
			.max(100),
		paymentMilestones: z
			.array(
				z.object({
					documentKey: keySchema,
					label: z.string().min(1).max(255),
					percentage: z.string(),
					timing: z.string().min(1).max(500),
				}),
			)
			.max(3),
	}),
});
export type BookingBlueprintV2 = z.infer<typeof bookingBlueprintV2Schema>;
