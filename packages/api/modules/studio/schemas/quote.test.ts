import { describe, expect, it } from "vitest";
import {
	assembleBookingInputFromBlueprintV1,
	bookingBlueprintOperationalMoneySchema,
	bookingBlueprintSchema,
	listQuotesInputSchema,
	quotationMoneySchema,
	quoteDraftContentInputSchema,
	quoteLineItemInputSchema,
	quoteOptionInputSchema,
	quoteStatusSchema,
} from "./quote";

const CLIENT_ID = "00000000-0000-4000-8000-000000000001";

const blueprint = {
	schemaVersion: 1 as const,
	booking: {
		name: "Kumar Wedding",
		bookingDate: "2026-04-22",
		bookingType: "wedding",
		packageType: "premium",
		events: [
			{
				eventType: "ceremony",
				eventDate: "2026-04-22T10:00:00.000Z",
			},
		],
		shoots: [
			{
				name: "Ceremony coverage",
				shootType: "wedding",
				shootDate: "2026-04-22",
				status: "scheduled",
				requiredCrewCount: 2,
				additionalServices: ["drone"],
			},
		],
		deliverables: [{ name: "Album", quantity: 1, isPackageIncluded: true }],
		paymentSchedules: [
			{
				name: "Deposit",
				amount: "50.00",
				dueDate: "2026-03-01",
				sortOrder: 0,
			},
		],
	},
};

const baseOption = {
	name: "Premium",
	subtotal: "12.53",
	discountAmount: "0.01",
	taxAmount: "0.02",
	totalAmount: "12.54",
	bookingBlueprint: blueprint,
	lineItems: [
		{
			type: "expense" as const,
			description: "Package",
			amount: "12.53",
		},
	],
};

const baseDraftContent = {
	title: "Kumar Wedding Quote",
	participants: [{ clientId: CLIENT_ID, role: "primary" }],
	options: [baseOption],
};

describe("quotation domain schemas", () => {
	it("recognizes the durable preparing lifecycle state", () => {
		expect(quoteStatusSchema.parse("preparing")).toBe("preparing");
	});

	it("allows the draft workspace to request document quotations explicitly", () => {
		expect(
			listQuotesInputSchema.parse({
				statuses: ["draft"],
				documentVersion: 1,
			}),
		).toMatchObject({ statuses: ["draft"], documentVersion: 1 });
	});

	it("rounds fractional quantity pricing half-up without Number arithmetic", () => {
		const result = quoteOptionInputSchema.safeParse({
			name: "Premium",
			subtotal: "12.53",
			discountAmount: "0.01",
			taxAmount: "0.02",
			totalAmount: "12.54",
			bookingBlueprint: blueprint,
			lineItems: [
				{
					type: "service",
					description: "Coverage",
					quantity: "1.25",
					unitPrice: "10.01",
					amount: "12.51",
				},
				{
					type: "item",
					description: "Print",
					quantity: "1.50",
					unitPrice: "0.01",
					amount: "0.02",
				},
			],
		});

		expect(result.success).toBe(true);
	});

	it("strips caller-owned itemized amounts and option totals", () => {
		const result = quoteOptionInputSchema.parse({
			name: "Premium",
			subtotal: "999.99",
			totalAmount: "999.99",
			bookingBlueprint: blueprint,
			lineItems: [
				{
					type: "service",
					description: "Coverage",
					quantity: "1.25",
					unitPrice: "10.01",
					amount: "999.99",
				},
			],
		});

		expect(result).not.toHaveProperty("subtotal");
		expect(result).not.toHaveProperty("totalAmount");
		expect(result.lineItems[0]).not.toHaveProperty("amount");
	});

	it("strips received payments and caller payment schedule ordering", () => {
		const parsed = quoteOptionInputSchema.parse({
			...baseOption,
			bookingBlueprint: {
				...blueprint,
				booking: {
					...blueprint.booking,
					receivedPayments: [
						{
							amount: "12.54",
							paymentMethod: "cash",
							receivedDate: "2026-03-01",
						},
					],
					paymentSchedules: [
						{
							name: "Full payment",
							amount: "12.54",
							dueDate: "2026-03-01",
							sortOrder: 99,
						},
					],
				},
			},
		});

		expect(parsed.bookingBlueprint.booking).not.toHaveProperty(
			"receivedPayments",
		);
		expect(
			parsed.bookingBlueprint.booking.paymentSchedules?.[0],
		).not.toHaveProperty("sortOrder");
	});

	it("preserves participant side and complete shoot assignment evidence", () => {
		const parsed = quoteDraftContentInputSchema.parse({
			...baseDraftContent,
			participants: [
				{
					clientId: CLIENT_ID,
					role: "bride",
					side: "bride",
					isPrimary: true,
				},
			],
			options: [
				{
					...baseOption,
					bookingBlueprint: {
						...blueprint,
						booking: {
							...blueprint.booking,
							shoots: [
								{
									name: "Ceremony",
									shootType: "wedding",
									shootDate: "2026-04-22",
									startTime: "09:00",
									endTime: "13:00",
									venue: "Lotus Hall",
									venueAddress: "MG Road, Bengaluru",
									status: "scheduled",
									crewAssignments: [
										{
											crewId: CLIENT_ID,
											role: "Lead photographer",
											isLead: true,
											rate: "25000.00",
										},
									],
								},
							],
						},
					},
				},
			],
		});
		expect(parsed.participants[0]?.side).toBe("bride");
		expect(
			parsed.options[0]?.bookingBlueprint.booking.shoots?.[0],
		).toMatchObject({
			endTime: "13:00",
			venue: "Lotus Hall",
			venueAddress: "MG Road, Bengaluru",
			crewAssignments: [
				{ role: "Lead photographer", isLead: true, rate: "25000.00" },
			],
		});
	});

	it("rejects unknown booking blueprint versions", () => {
		expect(
			bookingBlueprintSchema.safeParse({ ...blueprint, schemaVersion: 2 })
				.success,
		).toBe(false);
	});

	it("strips server-owned identity and lifecycle fields from draft content", () => {
		const parsed = quoteDraftContentInputSchema.parse({
			...baseDraftContent,
			quoteNumber: "CALLER-1",
			version: 99,
			supersedesQuoteId: "00000000-0000-4000-8000-000000000099",
			status: "accepted",
			sentAt: "2026-01-01T00:00:00.000Z",
			acceptedAt: "2026-01-02T00:00:00.000Z",
			convertedAt: "2026-01-03T00:00:00.000Z",
			declinedAt: "2026-01-04T00:00:00.000Z",
			expiredAt: "2026-01-05T00:00:00.000Z",
			supersededAt: "2026-01-06T00:00:00.000Z",
		});

		expect(parsed).not.toHaveProperty("quoteNumber");
		expect(parsed).not.toHaveProperty("version");
		expect(parsed).not.toHaveProperty("supersedesQuoteId");
		expect(parsed).not.toHaveProperty("status");
		expect(parsed).not.toHaveProperty("sentAt");
		expect(parsed).not.toHaveProperty("acceptedAt");
		expect(parsed).not.toHaveProperty("convertedAt");
		expect(parsed).not.toHaveProperty("declinedAt");
		expect(parsed).not.toHaveProperty("expiredAt");
		expect(parsed).not.toHaveProperty("supersededAt");
	});

	it("allows zero but rejects multiple primary participants", () => {
		expect(
			quoteDraftContentInputSchema.safeParse(baseDraftContent).success,
		).toBe(true);
		const duplicatePrimary = quoteDraftContentInputSchema.safeParse({
			...baseDraftContent,
			participants: [
				{ clientId: CLIENT_ID, role: "bride", isPrimary: true },
				{
					clientId: "00000000-0000-4000-8000-000000000002",
					role: "groom",
					isPrimary: true,
				},
			],
		});
		expect(duplicatePrimary.success).toBe(false);
	});

	it("allows zero but rejects multiple recommended options", () => {
		expect(
			quoteDraftContentInputSchema.safeParse(baseDraftContent).success,
		).toBe(true);
		const duplicateRecommended = quoteDraftContentInputSchema.safeParse({
			...baseDraftContent,
			options: [
				{ ...baseOption, isRecommended: true, sortOrder: 0 },
				{
					...baseOption,
					name: "Premium Plus",
					isRecommended: true,
					sortOrder: 1,
				},
			],
		});
		expect(duplicateRecommended.success).toBe(false);
	});

	it("accepts numeric(12,2) maximum and rejects quote money overflow", () => {
		expect(quotationMoneySchema.safeParse("9999999999.99").success).toBe(
			true,
		);
		expect(quotationMoneySchema.safeParse("10000000000.00").success).toBe(
			false,
		);
		expect(
			quoteOptionInputSchema.safeParse({
				...baseOption,
				subtotal: "10000000000.00",
				totalAmount: "10000000000.00",
				lineItems: [
					{
						type: "expense",
						description: "Overflow",
						amount: "10000000000.00",
					},
				],
			}).success,
		).toBe(false);
	});

	it("matches numeric(10,2) boundaries for blueprint operational costs", () => {
		expect(
			bookingBlueprintOperationalMoneySchema.safeParse("99999999.99")
				.success,
		).toBe(true);
		expect(
			bookingBlueprintOperationalMoneySchema.safeParse("100000000.00")
				.success,
		).toBe(false);

		const blueprintWithRate = (rate: string) => ({
			...blueprint,
			booking: {
				...blueprint.booking,
				shoots: [
					{
						name: "Boundary shoot",
						shootType: "wedding",
						shootDate: "2026-04-22",
						status: "scheduled",
						crewAssignments: [{ crewId: CLIENT_ID, rate }],
					},
				],
			},
		});
		expect(
			bookingBlueprintSchema.safeParse(blueprintWithRate("99999999.99"))
				.success,
		).toBe(true);
		expect(
			bookingBlueprintSchema.safeParse(blueprintWithRate("100000000.00"))
				.success,
		).toBe(false);

		const blueprintWithDeliverableCost = (cost: string) => ({
			...blueprint,
			booking: {
				...blueprint.booking,
				deliverables: [
					{
						name: "Boundary album",
						quantity: 1,
						isPackageIncluded: false,
						cost,
					},
				],
			},
		});
		expect(
			bookingBlueprintSchema.safeParse(
				blueprintWithDeliverableCost("99999999.99"),
			).success,
		).toBe(true);
		expect(
			bookingBlueprintSchema.safeParse(
				blueprintWithDeliverableCost("100000000.00"),
			).success,
		).toBe(false);
	});

	it("matches numeric(10,2) boundaries for line-item quantity", () => {
		const lineItem = (quantity: string, amount: string) => ({
			type: "item" as const,
			description: "Boundary quantity",
			quantity,
			unitPrice: "1.00",
			amount,
		});
		expect(
			quoteLineItemInputSchema.safeParse(
				lineItem("99999999.99", "99999999.99"),
			).success,
		).toBe(true);
		expect(
			quoteLineItemInputSchema.safeParse(
				lineItem("100000000.00", "100000000.00"),
			).success,
		).toBe(false);
	});

	it("applies quote money bounds inside booking blueprints", () => {
		const result = bookingBlueprintSchema.safeParse({
			...blueprint,
			booking: {
				...blueprint.booking,
				paymentSchedules: [
					{
						name: "Overflow",
						amount: "10000000000.00",
						dueDate: "2026-03-01",
						sortOrder: 0,
					},
				],
			},
		});
		expect(result.success).toBe(false);
	});

	it("rejects fractional quote pagination", () => {
		expect(listQuotesInputSchema.safeParse({ page: 1.5 }).success).toBe(
			false,
		);
		expect(listQuotesInputSchema.safeParse({ limit: 2.5 }).success).toBe(
			false,
		);
	});

	it("assembles the existing booking contract without duplicating participants or cost", () => {
		const input = assembleBookingInputFromBlueprintV1({
			blueprint,
			participants: [{ clientId: CLIENT_ID, role: "primary" }],
			packageCost: "12.54",
		});

		expect(input.participants).toEqual([
			{ clientId: CLIENT_ID, role: "primary" },
		]);
		expect(input.packageCost).toBe("12.54");
		expect(input.shoots?.[0]?.additionalServices).toEqual(["drone"]);
	});
});
