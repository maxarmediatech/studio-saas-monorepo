import { ORPCError } from "@orpc/server";
import {
	and,
	attachments,
	bookingEvents,
	bookingParticipants,
	bookings,
	clients,
	eq,
	inArray,
	isNull,
} from "@repo/database";
import type { TransactionClient } from "../../studio/lib/transactions";
import {
	type CreateBookingInput,
	createBookingInputSchema,
} from "../../studio/schemas/booking";
import {
	type BookingBlueprint,
	bookingBlueprintSchema,
} from "../../studio/schemas/quote";
import {
	createDeliverablesBatch,
	createPaymentsBatch,
	createShootsBatch,
	generateBookingReferenceNumber,
	validateCrewIds,
} from "../helpers";

export interface BookingMaterializationContext {
	organizationId: string;
	organizationName: string;
	userId: string;
}

export interface BookingQuoteProvenance {
	quoteId: string;
	quoteOptionId: string;
	quoteNumber: string;
	quoteVersion: number;
	bookingBlueprint: BookingBlueprint;
}

export interface StoredBookingQuoteProvenance {
	quoteId: string;
	quoteOptionId: string;
	quoteNumber: string;
	quoteVersion: number;
	bookingBlueprintVersion: number;
}

export interface BookingMaterializationResult {
	id: string;
	referenceNumber: string;
}

export interface BookingMaterializationOperations {
	validateClients(
		tx: TransactionClient,
		organizationId: string,
		clientIds: string[],
	): Promise<void>;
	validateCrews(
		tx: TransactionClient,
		organizationId: string,
		crewIds: string[],
	): Promise<void>;
	generateReferenceNumber(
		tx: TransactionClient,
		organizationId: string,
		organizationName: string,
	): Promise<string>;
	createBooking(
		tx: TransactionClient,
		context: BookingMaterializationContext,
		input: CreateBookingInput,
		referenceNumber: string,
		provenance?: StoredBookingQuoteProvenance,
	): Promise<string>;
	createParticipants(
		tx: TransactionClient,
		bookingId: string,
		participants: CreateBookingInput["participants"],
	): Promise<void>;
	createEvents(
		tx: TransactionClient,
		context: BookingMaterializationContext,
		bookingId: string,
		events: NonNullable<CreateBookingInput["events"]>,
	): Promise<void>;
	createShoots(
		tx: TransactionClient,
		context: BookingMaterializationContext,
		bookingId: string,
		shoots: NonNullable<CreateBookingInput["shoots"]>,
	): Promise<void>;
	createDeliverables(
		tx: TransactionClient,
		context: BookingMaterializationContext,
		bookingId: string,
		deliverables: NonNullable<CreateBookingInput["deliverables"]>,
	): Promise<void>;
	createPayments(
		tx: TransactionClient,
		context: BookingMaterializationContext,
		bookingId: string,
		receivedPayments: NonNullable<CreateBookingInput["receivedPayments"]>,
		paymentSchedules: NonNullable<CreateBookingInput["paymentSchedules"]>,
	): Promise<void>;
	createContractAttachment(
		tx: TransactionClient,
		context: BookingMaterializationContext,
		bookingId: string,
		attachment: NonNullable<CreateBookingInput["contractAttachment"]>,
	): Promise<void>;
}

function collectCrewIds(input: CreateBookingInput): string[] {
	return [
		...(input.shoots ?? []).flatMap((shoot) =>
			(shoot.crewAssignments ?? []).map(
				(assignment) => assignment.crewId,
			),
		),
		...(input.deliverables ?? []).flatMap((deliverable) =>
			(deliverable.crewAssignments ?? []).map(
				(assignment) => assignment.crewId,
			),
		),
	].filter(Boolean);
}

export const bookingMaterializationOperations: BookingMaterializationOperations =
	{
		async validateClients(tx, organizationId, clientIds) {
			const uniqueClientIds = [...new Set(clientIds)];
			const existingClients = await tx.query.clients.findMany({
				where: and(
					eq(clients.organizationId, organizationId),
					eq(clients.lifecycleStage, "client"),
					isNull(clients.deletedAt),
					inArray(clients.id, uniqueClientIds),
				),
				columns: { id: true },
			});
			const found = new Set(existingClients.map((client) => client.id));
			const missing = uniqueClientIds.filter((id) => !found.has(id));
			if (missing.length > 0) {
				throw new ORPCError("BAD_REQUEST", {
					message: `Client(s) not found: ${missing.join(", ")}`,
				});
			}
		},
		validateCrews: validateCrewIds,
		generateReferenceNumber: generateBookingReferenceNumber,
		async createBooking(tx, context, input, referenceNumber, provenance) {
			const [created] = await tx
				.insert(bookings)
				.values({
					organizationId: context.organizationId,
					referenceNumber,
					name: input.name,
					bookingDate: input.bookingDate,
					bookingType: input.bookingType,
					packageType: input.packageType,
					packageCost: input.packageCost,
					status: "new",
					totalReceived: "0",
					totalExpenses: "0",
					note: input.note ?? null,
					sourceQuoteId: provenance?.quoteId ?? null,
					sourceQuoteOptionId: provenance?.quoteOptionId ?? null,
					sourceQuoteNumber: provenance?.quoteNumber ?? null,
					sourceQuoteVersion: provenance?.quoteVersion ?? null,
					sourceBookingBlueprintVersion:
						provenance?.bookingBlueprintVersion ?? null,
					createdBy: context.userId,
				})
				.returning({ id: bookings.id });
			if (!created) {
				throw new ORPCError("INTERNAL_SERVER_ERROR", {
					message: "Failed to create booking",
				});
			}
			return created.id;
		},
		async createParticipants(tx, bookingId, participants) {
			await tx.insert(bookingParticipants).values(
				participants.map((participant) => ({
					bookingId,
					clientId: participant.clientId,
					role: participant.role,
				})),
			);
		},
		async createEvents(tx, context, bookingId, events) {
			await tx.insert(bookingEvents).values(
				events.map((event) => ({
					bookingId,
					organizationId: context.organizationId,
					eventType: event.eventType,
					eventDate: event.eventDate
						? new Date(event.eventDate)
						: null,
					side: event.side ?? "common",
					guestCount: event.guestCount ?? null,
					isTentative: event.isTentative ?? false,
					dateWindow: event.dateWindow ?? null,
					coverageNotes: event.coverageNotes ?? null,
					venue: event.venue ?? null,
					venueAddress: event.venueAddress ?? null,
					notes: event.notes ?? null,
				})),
			);
		},
		async createShoots(tx, context, bookingId, shoots) {
			await createShootsBatch(
				tx,
				context.organizationId,
				bookingId,
				context.userId,
				shoots,
			);
		},
		async createDeliverables(tx, context, bookingId, deliverables) {
			await createDeliverablesBatch(
				tx,
				context.organizationId,
				bookingId,
				context.userId,
				deliverables,
			);
		},
		async createPayments(
			tx,
			context,
			bookingId,
			receivedPayments,
			paymentSchedules,
		) {
			await createPaymentsBatch(
				tx,
				context.organizationId,
				bookingId,
				context.userId,
				receivedPayments,
				paymentSchedules,
			);
		},
		async createContractAttachment(tx, context, bookingId, attachment) {
			const expectedPrefix = `orgs/${context.organizationId}/`;
			if (!attachment.key.startsWith(expectedPrefix)) {
				throw new ORPCError("FORBIDDEN", {
					message:
						"Invalid attachment: file does not belong to this organization",
				});
			}
			await tx.insert(attachments).values({
				organizationId: context.organizationId,
				entityType: "booking",
				entityId: bookingId,
				fileName: attachment.name,
				fileUrl: attachment.key,
				fileSize: attachment.size,
				mimeType: attachment.type,
				description: "contract",
				uploadedBy: context.userId,
			});
		},
	};

export function deriveStoredQuoteProvenance(
	provenance: BookingQuoteProvenance,
): StoredBookingQuoteProvenance {
	const blueprint = bookingBlueprintSchema.parse(provenance.bookingBlueprint);
	return {
		quoteId: provenance.quoteId,
		quoteOptionId: provenance.quoteOptionId,
		quoteNumber: provenance.quoteNumber,
		quoteVersion: provenance.quoteVersion,
		bookingBlueprintVersion: blueprint.schemaVersion,
	};
}

/**
 * Canonical transactional booking graph boundary. Both direct creation and
 * quote conversion call this function inside their owning transaction.
 */
export async function materializeBooking(
	tx: TransactionClient,
	context: BookingMaterializationContext,
	input: CreateBookingInput,
	options: {
		provenance?: BookingQuoteProvenance;
		operations?: BookingMaterializationOperations;
	} = {},
): Promise<BookingMaterializationResult> {
	const validated = createBookingInputSchema.parse(input);
	const provenance = options.provenance
		? deriveStoredQuoteProvenance(options.provenance)
		: undefined;
	const operations = options.operations ?? bookingMaterializationOperations;
	await operations.validateClients(
		tx,
		context.organizationId,
		validated.participants.map((participant) => participant.clientId),
	);
	const crewIds = collectCrewIds(validated);
	if (crewIds.length > 0) {
		await operations.validateCrews(tx, context.organizationId, crewIds);
	}
	const referenceNumber = await operations.generateReferenceNumber(
		tx,
		context.organizationId,
		context.organizationName,
	);
	const id = await operations.createBooking(
		tx,
		context,
		validated,
		referenceNumber,
		provenance,
	);
	await operations.createParticipants(tx, id, validated.participants);
	if (validated.events?.length) {
		await operations.createEvents(tx, context, id, validated.events);
	}
	if (validated.shoots?.length) {
		await operations.createShoots(tx, context, id, validated.shoots);
	}
	if (validated.deliverables?.length) {
		await operations.createDeliverables(
			tx,
			context,
			id,
			validated.deliverables,
		);
	}
	if (
		validated.receivedPayments?.length ||
		validated.paymentSchedules?.length
	) {
		await operations.createPayments(
			tx,
			context,
			id,
			validated.receivedPayments ?? [],
			validated.paymentSchedules ?? [],
		);
	}
	if (validated.contractAttachment) {
		await operations.createContractAttachment(
			tx,
			context,
			id,
			validated.contractAttachment,
		);
	}
	return { id, referenceNumber };
}
