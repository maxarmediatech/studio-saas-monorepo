import { describe, expect, it, vi } from "vitest";
import type { TransactionClient } from "../../studio/lib/transactions";
import {
	type BookingMaterializationOperations,
	materializeBooking,
} from "./materialize-booking";

const CLIENT_ID = "00000000-0000-4000-8000-000000000001";
const CREW_ID = "00000000-0000-4000-8000-000000000002";
const tx = {} as TransactionClient;

function createOperations(): BookingMaterializationOperations {
	return {
		validateClients: vi.fn(async () => undefined),
		validateCrews: vi.fn(async () => undefined),
		generateReferenceNumber: vi.fn(async () => "STU-2604-0001"),
		createBooking: vi.fn(async () => "booking-1"),
		createParticipants: vi.fn(async () => undefined),
		createEvents: vi.fn(async () => undefined),
		createShoots: vi.fn(async () => undefined),
		createDeliverables: vi.fn(async () => undefined),
		createPayments: vi.fn(async () => undefined),
		createContractAttachment: vi.fn(async () => undefined),
	};
}

const context = {
	organizationId: "organization-1",
	organizationName: "Studio One",
	userId: "user-1",
};

const bookingBlueprint = {
	schemaVersion: 1 as const,
	booking: {
		name: "Kumar Wedding",
		bookingDate: "2026-04-22",
		bookingType: "wedding",
		packageType: "premium",
	},
};

const completeInput = {
	name: "Kumar Wedding",
	bookingDate: "2026-04-22",
	bookingType: "wedding",
	packageType: "premium",
	packageCost: "150000.00",
	participants: [{ clientId: CLIENT_ID, role: "primary" }],
	events: [
		{
			eventType: "ceremony",
			eventDate: "2026-04-22T10:00:00.000Z",
		},
	],
	shoots: [
		{
			name: "Ceremony",
			shootType: "wedding",
			shootDate: "2026-04-22",
			status: "scheduled",
			crewAssignments: [{ crewId: CREW_ID }],
		},
	],
	deliverables: [
		{
			name: "Album",
			quantity: 1,
			isPackageIncluded: false,
			crewAssignments: [{ crewId: CREW_ID }],
		},
	],
	receivedPayments: [
		{
			amount: "1000.00",
			paymentMethod: "upi" as const,
			receivedDate: "2026-03-01",
		},
	],
	paymentSchedules: [
		{
			name: "Balance",
			amount: "149000.00",
			dueDate: "2026-04-01",
			sortOrder: 0,
		},
	],
	contractAttachment: {
		name: "contract.pdf",
		size: 1024,
		type: "application/pdf",
		key: "orgs/organization-1/contracts/contract.pdf",
		url: "https://example.com/contract.pdf",
	},
};

describe("materializeBooking", () => {
	it("preserves the complete direct-booking graph through one boundary", async () => {
		const operations = createOperations();
		const result = await materializeBooking(tx, context, completeInput, {
			operations,
		});

		expect(result).toEqual({
			id: "booking-1",
			referenceNumber: "STU-2604-0001",
		});
		expect(operations.validateClients).toHaveBeenCalledWith(
			tx,
			"organization-1",
			[CLIENT_ID],
		);
		expect(operations.validateCrews).toHaveBeenCalledWith(
			tx,
			"organization-1",
			[CREW_ID, CREW_ID],
		);
		expect(operations.createEvents).toHaveBeenCalledOnce();
		expect(operations.createShoots).toHaveBeenCalledOnce();
		expect(operations.createDeliverables).toHaveBeenCalledOnce();
		expect(operations.createPayments).toHaveBeenCalledOnce();
		expect(operations.createContractAttachment).toHaveBeenCalledOnce();
	});

	it("derives immutable blueprint version provenance for the booking record", async () => {
		const operations = createOperations();
		const provenance = {
			quoteId: "quote-1",
			quoteOptionId: "option-1",
			quoteNumber: "Q-2026-0042",
			quoteVersion: 3,
			bookingBlueprint,
		};

		await materializeBooking(tx, context, completeInput, {
			operations,
			provenance,
		});

		expect(operations.createBooking).toHaveBeenCalledWith(
			tx,
			context,
			expect.objectContaining({ name: "Kumar Wedding" }),
			"STU-2604-0001",
			{
				quoteId: provenance.quoteId,
				quoteOptionId: provenance.quoteOptionId,
				quoteNumber: provenance.quoteNumber,
				quoteVersion: provenance.quoteVersion,
				bookingBlueprintVersion: 1,
			},
		);
	});

	it("rejects unvalidated blueprint versions before materialization", async () => {
		const operations = createOperations();
		await expect(
			materializeBooking(tx, context, completeInput, {
				operations,
				provenance: {
					quoteId: "quote-1",
					quoteOptionId: "option-1",
					quoteNumber: "Q-2026-0042",
					quoteVersion: 3,
					bookingBlueprint: {
						...bookingBlueprint,
						schemaVersion: 2,
					} as never,
				},
			}),
		).rejects.toThrow();
		expect(operations.createBooking).not.toHaveBeenCalled();
	});
});
