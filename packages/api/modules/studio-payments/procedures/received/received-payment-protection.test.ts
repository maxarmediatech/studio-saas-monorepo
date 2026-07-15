import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
	const handlers: Array<
		(options: {
			input: Record<string, unknown>;
			context: {
				organizationId: string;
				user: { id: string };
			};
		}) => Promise<unknown>
	> = [];
	const chain = {
		route: vi.fn(() => chain),
		input: vi.fn(() => chain),
		output: vi.fn(() => chain),
		handler: vi.fn((handler) => {
			handlers.push(handler);
			return chain;
		}),
	};
	const tx = {
		query: {
			bookings: { findFirst: vi.fn() },
			receivedAmounts: { findFirst: vi.fn() },
		},
		update: vi.fn(),
	};

	return {
		chain,
		handlers,
		mockGetLockedBookingForReceipt: vi.fn(),
		mockGetLockedReceivedPayment: vi.fn(),
		mockGetPaymentFinancialProtection: vi.fn(),
		mockRequirePermission: vi.fn(),
		mockSafeTrackActivity: vi.fn(),
		mockTransaction: vi.fn(async (callback) => callback(tx)),
		tx,
	};
});

vi.mock("../../../../orpc/procedures", () => ({
	studioProtectedProcedure: mocks.chain,
}));

vi.mock("../../../studio/lib/permissions", () => ({
	requirePermission: mocks.mockRequirePermission,
}));

vi.mock("../../../activities/lib", () => ({
	formatAmount: vi.fn((amount: string) => amount),
	safeTrackActivity: mocks.mockSafeTrackActivity,
}));

vi.mock("../../../receipts/lib/locked-invoice-for-receipt", () => ({
	getLockedBookingForReceipt: mocks.mockGetLockedBookingForReceipt,
}));

vi.mock("../../lib/payment-financial-protection", () => ({
	assertPaymentDeletable: (protection: { canDelete: boolean }) => {
		if (!protection.canDelete) {
			throw new Error("delete locked");
		}
	},
	assertPaymentFinancialDetailsEditable: (protection: {
		canEditFinancialDetails: boolean;
	}) => {
		if (!protection.canEditFinancialDetails) {
			throw new Error("details locked");
		}
	},
	getPaymentFinancialProtection: mocks.mockGetPaymentFinancialProtection,
}));

vi.mock("../../lib/received-payment-lock", () => ({
	getLockedReceivedPayment: mocks.mockGetLockedReceivedPayment,
}));

vi.mock("@repo/database", () => ({
	and: vi.fn((...conditions: unknown[]) => conditions),
	bookings: {
		id: "bookingId",
		organizationId: "bookingOrganizationId",
		totalReceived: "totalReceived",
	},
	db: { transaction: mocks.mockTransaction },
	eq: vi.fn((column: unknown, value: unknown) => ({ column, value })),
	isNull: vi.fn((column: unknown) => ({ column, isNull: true })),
	receivedAmounts: {
		deletedAt: "deletedAt",
		id: "id",
		organizationId: "organizationId",
	},
	sql: vi.fn(),
}));

import "./delete-received";
import "./update-received";

const context = { organizationId: "org_1", user: { id: "user_1" } };

describe("received payment financial protection handlers", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.tx.query.receivedAmounts.findFirst.mockResolvedValue({
			bookingId: "booking_1",
		});
		mocks.mockGetLockedBookingForReceipt.mockResolvedValue({
			id: "booking_1",
			name: "Booking One",
		});
	});

	it("re-reads invoice protection after locking before an amount update", async () => {
		const events: string[] = [];
		mocks.mockGetLockedBookingForReceipt.mockImplementation(async () => {
			events.push("booking-lock");
			return { id: "booking_1", name: "Booking One" };
		});
		mocks.mockGetLockedReceivedPayment.mockImplementation(async () => {
			events.push("lock-and-read");
			return {
				id: "payment_1",
				amount: "100.00",
				bookingId: "booking_1",
				invoiceId: "invoice_1",
				paymentScheduleId: null,
				paymentMethod: "cash",
				receivedDate: "2026-01-01",
			};
		});
		mocks.mockGetPaymentFinancialProtection.mockImplementation(async () => {
			events.push("protection");
			return { canEditFinancialDetails: false };
		});

		await expect(
			mocks.handlers[1]({
				context,
				input: { id: "payment_1", amount: "120.00" },
			}),
		).rejects.toThrow("details locked");

		expect(events).toEqual(["booking-lock", "lock-and-read", "protection"]);
		expect(mocks.tx.update).not.toHaveBeenCalled();
	});

	it("re-reads schedule protection after locking before deletion", async () => {
		const events: string[] = [];
		mocks.mockGetLockedBookingForReceipt.mockImplementation(async () => {
			events.push("booking-lock");
			return { id: "booking_1", name: "Booking One" };
		});
		mocks.mockGetLockedReceivedPayment.mockImplementation(async () => {
			events.push("lock-and-read");
			return {
				id: "payment_1",
				amount: "100.00",
				bookingId: "booking_1",
				invoiceId: null,
				paymentScheduleId: "schedule_1",
				paymentMethod: "cash",
			};
		});
		mocks.mockGetPaymentFinancialProtection.mockImplementation(async () => {
			events.push("protection");
			return { canDelete: false };
		});

		await expect(
			mocks.handlers[0]({
				context,
				input: { id: "payment_1" },
			}),
		).rejects.toThrow("delete locked");

		expect(events).toEqual(["booking-lock", "lock-and-read", "protection"]);
		expect(mocks.tx.update).not.toHaveBeenCalled();
	});
});
