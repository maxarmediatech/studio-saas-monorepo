import { ORPCError } from "@orpc/server";
import {
	and,
	attachments,
	bookingEvents,
	bookingParticipants,
	bookings,
	clients,
	count,
	db,
	deliverables,
	eq,
	isNull,
	quoteAcceptances,
	shoots,
	tasks,
} from "@repo/database";
import { studioProtectedProcedure } from "../../../orpc/procedures";
import { requirePermission } from "../../studio/lib/permissions";
import {
	getBookingInputSchema,
	getBookingOutputSchema,
} from "../../studio/schemas/booking";
import { quotationDocumentV1Schema } from "../../studio/schemas/quotation-document";

export const getBooking = studioProtectedProcedure
	.route({
		method: "GET",
		path: "/bookings/{id}",
		tags: ["Bookings"],
		summary: "Get booking",
		description: "Get a single booking by ID with related entities",
	})
	.input(getBookingInputSchema)
	.output(getBookingOutputSchema)
	.handler(async ({ input, context }) => {
		await requirePermission(context, "booking", "read");

		const { id } = input;

		// Get booking with organization scope
		const booking = await db.query.bookings.findFirst({
			where: and(
				eq(bookings.id, id),
				eq(bookings.organizationId, context.organizationId),
			),
		});

		if (!booking) {
			throw new ORPCError("NOT_FOUND", {
				message: "Booking not found",
			});
		}

		// Get participants with client info
		const participants = await db
			.select({
				id: bookingParticipants.id,
				bookingId: bookingParticipants.bookingId,
				clientId: bookingParticipants.clientId,
				role: bookingParticipants.role,
				createdAt: bookingParticipants.createdAt,
				updatedAt: bookingParticipants.updatedAt,
				client: {
					id: clients.id,
					name: clients.name,
					email: clients.email,
					phoneNumber: clients.phoneNumber,
				},
			})
			.from(bookingParticipants)
			.innerJoin(clients, eq(bookingParticipants.clientId, clients.id))
			.where(eq(bookingParticipants.bookingId, id));

		// Get events
		const events = await db.query.bookingEvents.findMany({
			where: eq(bookingEvents.bookingId, id),
			orderBy: (table, { asc }) => [asc(table.eventDate)],
		});

		// Get counts
		const [shootsCountResult] = await db
			.select({ count: count().mapWith(Number) })
			.from(shoots)
			.where(
				and(
					eq(shoots.bookingId, id),
					eq(shoots.organizationId, context.organizationId),
					isNull(shoots.deletedAt),
				),
			);

		const [tasksCountResult] = await db
			.select({ count: count().mapWith(Number) })
			.from(tasks)
			.where(
				and(
					eq(tasks.bookingId, id),
					eq(tasks.organizationId, context.organizationId),
					isNull(tasks.deletedAt),
				),
			);

		const [deliverablesCountResult] = await db
			.select({ count: count().mapWith(Number) })
			.from(deliverables)
			.where(
				and(
					eq(deliverables.bookingId, id),
					eq(deliverables.organizationId, context.organizationId),
					isNull(deliverables.deletedAt),
				),
			);

		const contractAttachmentRow = await db.query.attachments.findFirst({
			where: and(
				eq(attachments.entityType, "booking"),
				eq(attachments.entityId, id),
				eq(attachments.description, "contract"),
				isNull(attachments.deletedAt),
			),
		});

		const contractAttachment = contractAttachmentRow
			? {
					name: contractAttachmentRow.fileName,
					size: contractAttachmentRow.fileSize ?? 0,
					type: contractAttachmentRow.mimeType ?? "",
					key: contractAttachmentRow.fileUrl,
					url: contractAttachmentRow.fileUrl,
				}
			: null;
		const acceptance = booking.sourceQuoteId
			? await db.query.quoteAcceptances.findFirst({
					where: and(
						eq(quoteAcceptances.quoteId, booking.sourceQuoteId),
						eq(
							quoteAcceptances.organizationId,
							context.organizationId,
						),
					),
					columns: { documentSnapshot: true },
				})
			: null;
		const acceptedDocument = quotationDocumentV1Schema.safeParse(
			acceptance?.documentSnapshot,
		);
		const sourceQuotationCommitments = acceptedDocument.success
			? {
					deliveryTimelines:
						acceptedDocument.data.deliveryTimelines.map(
							({ text }) => text,
						),
					fixedTerms: acceptedDocument.data.fixedTerms.map(
						({ text }) => text,
					),
				}
			: null;

		const packageCost = Number.parseFloat(booking.packageCost);
		const totalReceived = Number.parseFloat(booking.totalReceived);
		const balance = (packageCost - totalReceived).toFixed(2);

		return {
			data: {
				...booking,
				createdAt: booking.createdAt.toISOString(),
				updatedAt: booking.updatedAt.toISOString(),
				deletedAt: booking.deletedAt?.toISOString() ?? null,
				participants: participants.map((p) => ({
					...p,
					createdAt: p.createdAt.toISOString(),
					updatedAt: p.updatedAt.toISOString(),
				})),
				events: events.map((e) => ({
					...e,
					eventDate: e.eventDate?.toISOString() ?? null,
					createdAt: e.createdAt.toISOString(),
					updatedAt: e.updatedAt.toISOString(),
				})),
				shootsCount: shootsCountResult?.count ?? 0,
				tasksCount: tasksCountResult?.count ?? 0,
				deliverablesCount: deliverablesCountResult?.count ?? 0,
				balance,
				contractAttachment,
				sourceQuotationCommitments,
			},
		};
	});
