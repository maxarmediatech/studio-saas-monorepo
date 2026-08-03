import { TZDate } from "@date-fns/tz";
import { ORPCError } from "@orpc/server";
import {
	and,
	bookings,
	clients,
	db,
	eq,
	inArray,
	isNull,
	quoteAcceptances,
	quoteParticipants,
	quotes,
} from "@repo/database";
import { trackActivityWithExecutor } from "../../activities/lib";
import { materializeBooking } from "../../bookings/lib/materialize-booking";
import { formatDateParts, getDateParts } from "../../studio/lib/date-helpers";
import type { CreateBookingInput } from "../../studio/schemas/booking";
import {
	bookingBlueprintV2Schema,
	quotationDocumentV1Schema,
	quotationPdfSnapshotV1Schema,
} from "../../studio/schemas/quotation-document";
import {
	acceptedQuoteOptionSnapshotSchema,
	assembleBookingInputFromBlueprintV1,
	bookingBlueprintV1Schema,
} from "../../studio/schemas/quote";
import { allocateMilestoneAmounts } from "./quotation-document";
import type { QuoteServiceContext } from "./quote-service";

export interface ConvertedBookingResult {
	id: string;
	referenceNumber: string;
	status: string;
	deletedAt: Date | null;
}

export function assertDocumentAcceptanceProvenance(
	acceptance: {
		documentSha256: string | null;
		pdfSnapshot: unknown;
	},
	quote: {
		documentSha256: string | null;
		pdfSha256: string | null;
		pdfStorageKey: string | null;
		pdfRendererVersion: string | null;
		pdfPageCount: number | null;
		pdfByteSize: number | null;
	},
) {
	const acceptedPdf = quotationPdfSnapshotV1Schema.safeParse(
		acceptance.pdfSnapshot,
	);
	if (
		acceptance.documentSha256 !== quote.documentSha256 ||
		!acceptedPdf.success ||
		acceptedPdf.data.sha256 !== quote.pdfSha256 ||
		acceptedPdf.data.storageKey !== quote.pdfStorageKey ||
		acceptedPdf.data.rendererVersion !== quote.pdfRendererVersion ||
		acceptedPdf.data.pageCount !== quote.pdfPageCount ||
		acceptedPdf.data.byteSize !== quote.pdfByteSize
	) {
		throw new ORPCError("INTERNAL_SERVER_ERROR", {
			message: "Quotation acceptance document or PDF provenance mismatch",
		});
	}
	return acceptedPdf.data;
}

function localMidnightIso(date: string, timezone: string): string {
	const [year, month, day] = date.split("-").map(Number);
	return new TZDate(year, month - 1, day, 0, 0, 0, 0, timezone).toISOString();
}

export async function convertAcceptedQuote(
	context: QuoteServiceContext,
	quoteId: string,
): Promise<ConvertedBookingResult> {
	return db.transaction(async (tx) => {
		const [quote] = await tx
			.select()
			.from(quotes)
			.where(
				and(
					eq(quotes.id, quoteId),
					eq(quotes.organizationId, context.organizationId),
					isNull(quotes.deletedAt),
				),
			)
			.for("update");
		if (!quote) {
			throw new ORPCError("NOT_FOUND", { message: "Quote not found" });
		}

		const findConvertedBooking = () =>
			tx.query.bookings.findFirst({
				where: and(
					eq(bookings.organizationId, context.organizationId),
					eq(bookings.sourceQuoteId, quote.id),
				),
				columns: {
					id: true,
					referenceNumber: true,
					status: true,
					deletedAt: true,
				},
			});
		if (quote.status === "converted") {
			const existing = await findConvertedBooking();
			if (!existing) {
				throw new ORPCError("INTERNAL_SERVER_ERROR", {
					message: "Converted quote booking is missing",
				});
			}
			return existing;
		}
		if (quote.status !== "accepted") {
			throw new ORPCError("CONFLICT", {
				message: "Only accepted quotes can be converted",
			});
		}

		const acceptance = await tx.query.quoteAcceptances.findFirst({
			where: and(
				eq(quoteAcceptances.quoteId, quote.id),
				eq(quoteAcceptances.organizationId, context.organizationId),
			),
		});
		if (!acceptance) {
			throw new ORPCError("CONFLICT", {
				message: "Accepted quote has no persisted acceptance",
			});
		}
		const snapshot = acceptedQuoteOptionSnapshotSchema.parse(
			acceptance.optionSnapshot,
		);
		if (
			snapshot.quoteId !== quote.id ||
			snapshot.quoteOptionId !== acceptance.quoteOptionId ||
			snapshot.quoteNumber !== quote.quoteNumber ||
			snapshot.quoteVersion !== quote.version
		) {
			throw new ORPCError("INTERNAL_SERVER_ERROR", {
				message: "Quote acceptance snapshot provenance mismatch",
			});
		}
		const isDocumentQuote = quote.documentVersion === 1;
		const blueprint = isDocumentQuote
			? bookingBlueprintV2Schema.parse(snapshot.option.bookingBlueprint)
			: bookingBlueprintV1Schema.parse(snapshot.option.bookingBlueprint);
		const participants = await tx.query.quoteParticipants.findMany({
			where: and(
				eq(quoteParticipants.quoteId, quote.id),
				eq(quoteParticipants.organizationId, context.organizationId),
			),
			orderBy: (table, { asc }) => [asc(table.sortOrder)],
		});
		let bookingInput: CreateBookingInput;
		if (isDocumentQuote) {
			const documentBlueprint = bookingBlueprintV2Schema.parse(blueprint);
			const document = quotationDocumentV1Schema.parse(
				acceptance.documentSnapshot,
			);
			assertDocumentAcceptanceProvenance(acceptance, quote);
			const acceptedPackage = document.packages.find(
				(item) => item.key === documentBlueprint.optionKey,
			);
			if (!acceptedPackage) {
				throw new ORPCError("INTERNAL_SERVER_ERROR", {
					message:
						"Accepted package is missing from quotation document",
				});
			}
			const amounts = new Map(
				allocateMilestoneAmounts(
					snapshot.option.totalAmount,
					document.paymentMilestones,
				).map((row) => [row.key, row.amount]),
			);
			const bookingDate = formatDateParts(
				getDateParts(
					acceptance.acceptedAt,
					context.membership.organization.timezone,
				),
			);
			bookingInput = {
				name: document.title,
				bookingDate,
				bookingType: document.quotationType.label,
				packageType: acceptedPackage.name,
				packageCost: snapshot.option.totalAmount,
				participants: participants.map((participant, index) => ({
					clientId: participant.clientId,
					role: index === 0 ? "primary_client" : "client",
				})),
				events: documentBlueprint.booking.events.map((event) => ({
					eventType: event.eventType,
					eventDate: event.eventDate
						? localMidnightIso(
								event.eventDate,
								context.membership.organization.timezone,
							)
						: null,
					side: event.side,
					guestCount: event.guestCount,
					isTentative: event.isTentative,
					dateWindow: event.dateWindow,
					venue: event.location ?? undefined,
					notes: event.notes ?? undefined,
					coverageNotes: event.coverageNotes,
				})),
				deliverables: documentBlueprint.booking.deliverables.map(
					(deliverable) => ({
						name: deliverable.name,
						quantity: deliverable.quantity,
						description: deliverable.description ?? undefined,
						dueDate: undefined,
						crewAssignments: [],
						isPackageIncluded: true,
					}),
				),
				paymentSchedules:
					documentBlueprint.booking.paymentMilestones.map(
						(milestone, index) => ({
							name: milestone.label,
							amount:
								amounts.get(milestone.documentKey) ?? "0.00",
							dueDate: null,
							percentage: milestone.percentage,
							timing: milestone.timing,
							sortOrder: index,
						}),
					),
			};
			const clientIds = participants.map(({ clientId }) => clientId);
			const leads = clientIds.length
				? await tx.query.clients.findMany({
						where: and(
							eq(clients.organizationId, context.organizationId),
							eq(clients.lifecycleStage, "lead"),
							inArray(clients.id, clientIds),
						),
					})
				: [];
			for (const lead of leads) {
				await tx
					.update(clients)
					.set({
						lifecycleStage: "client",
						updatedAt: new Date(),
						updatedBy: context.user.id,
					})
					.where(eq(clients.id, lead.id));
				await trackActivityWithExecutor(
					tx,
					{
						organizationId: context.organizationId,
						user: context.user,
					},
					{
						entityType: "client",
						entityId: lead.id,
						entityName: lead.name,
						action: "status_changed",
						field: "lifecycleStage",
						oldValue: "lead",
						newValue: "client",
						metadata: { sourceQuoteId: quote.id },
					},
				);
			}
		} else {
			bookingInput = assembleBookingInputFromBlueprintV1({
				blueprint: bookingBlueprintV1Schema.parse(blueprint),
				participants: participants.map((participant) => ({
					clientId: participant.clientId,
					role: participant.role,
				})),
				packageCost: snapshot.option.totalAmount,
			});
		}
		const created = await materializeBooking(
			tx,
			{
				organizationId: context.organizationId,
				organizationName: context.membership.organization.name,
				userId: context.user.id,
			},
			bookingInput,
			{
				provenance: {
					quoteId: quote.id,
					quoteOptionId: acceptance.quoteOptionId,
					quoteNumber: quote.quoteNumber,
					quoteVersion: quote.version,
					bookingBlueprint: blueprint,
				},
			},
		);
		await trackActivityWithExecutor(
			tx,
			{ organizationId: context.organizationId, user: context.user },
			{
				entityType: "booking",
				entityId: created.id,
				entityName: bookingInput.name,
				action: "created",
				metadata: {
					referenceNumber: created.referenceNumber,
					packageType: bookingInput.packageType,
					packageCost: bookingInput.packageCost,
					sourceQuoteId: quote.id,
				},
			},
		);
		const now = new Date();
		const transitioned = await tx
			.update(quotes)
			.set({
				status: "converted",
				convertedAt: now,
				updatedAt: now,
				updatedBy: context.user.id,
			})
			.where(
				and(
					eq(quotes.id, quote.id),
					eq(quotes.organizationId, context.organizationId),
					eq(quotes.status, "accepted"),
				),
			)
			.returning({ id: quotes.id });
		if (!transitioned[0]) {
			throw new ORPCError("CONFLICT", {
				message: "Quote conversion state changed",
			});
		}
		await trackActivityWithExecutor(
			tx,
			{ organizationId: context.organizationId, user: context.user },
			{
				entityType: "quote",
				entityId: quote.id,
				entityName: quote.title,
				action: "status_changed",
				field: "status",
				oldValue: "accepted",
				newValue: "converted",
				metadata: { bookingId: created.id },
			},
		);
		return {
			id: created.id,
			referenceNumber: created.referenceNumber,
			status: "new",
			deletedAt: null,
		};
	});
}
