import { ORPCError } from "@orpc/server";
import {
	and,
	bookings,
	db,
	eq,
	isNull,
	quoteAcceptances,
	quoteParticipants,
	quotes,
} from "@repo/database";
import { trackActivityWithExecutor } from "../../activities/lib";
import { materializeBooking } from "../../bookings/lib/materialize-booking";
import {
	acceptedQuoteOptionSnapshotSchema,
	assembleBookingInputFromBlueprintV1,
	bookingBlueprintV1Schema,
} from "../../studio/schemas/quote";
import type { QuoteServiceContext } from "./quote-service";

export interface ConvertedBookingResult {
	id: string;
	referenceNumber: string;
	status: string;
	deletedAt: Date | null;
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
		const blueprint = bookingBlueprintV1Schema.parse(
			snapshot.option.bookingBlueprint,
		);
		const participants = await tx.query.quoteParticipants.findMany({
			where: and(
				eq(quoteParticipants.quoteId, quote.id),
				eq(quoteParticipants.organizationId, context.organizationId),
			),
			orderBy: (table, { asc }) => [asc(table.sortOrder)],
		});
		const bookingInput = assembleBookingInputFromBlueprintV1({
			blueprint,
			participants: participants.map((participant) => ({
				clientId: participant.clientId,
				role: participant.role,
			})),
			packageCost: snapshot.option.totalAmount,
		});
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
