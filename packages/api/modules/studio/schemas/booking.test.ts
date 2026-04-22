import { describe, expect, it } from "vitest";
import {
	createBookingInputSchema,
	listBookingsInputSchema,
} from "./booking";

const CLIENT_ID = "00000000-0000-4000-8000-000000000001";

const baseCreateBookingInput = {
	name: "Kumar Wedding",
	bookingDate: "2026-04-22",
	bookingType: "wedding",
	packageType: "premium",
	packageCost: "150000.00",
	participants: [{ clientId: CLIENT_ID, role: "primary" }],
};

describe("booking schemas", () => {
	it("requires booking date when creating a booking", () => {
		const { bookingDate, ...inputWithoutBookingDate } = baseCreateBookingInput;

		expect(
			createBookingInputSchema.safeParse(inputWithoutBookingDate).success,
		).toBe(false);
		expect(createBookingInputSchema.safeParse(baseCreateBookingInput).success).toBe(
			true,
		);
	});

	it("defaults booking list sorting to booking date", () => {
		const result = listBookingsInputSchema.parse({});

		expect(result.sortBy).toBe("bookingDate");
	});

	it("keeps createdAt as a legacy booking date filter alias", () => {
		const result = listBookingsInputSchema.safeParse({
			createdAt: "2026-04-01,2026-04-30",
		});

		expect(result.success).toBe(true);
	});
});
