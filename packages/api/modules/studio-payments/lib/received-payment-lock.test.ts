import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	and: vi.fn((...conditions: unknown[]) => conditions),
	eq: vi.fn((column: unknown, value: unknown) => ({ column, value })),
	isNull: vi.fn((column: unknown) => ({ column })),
	sql: vi.fn((strings: TemplateStringsArray, ...values: unknown[]) => ({
		strings,
		values,
	})),
}));

vi.mock("@repo/database", () => ({
	and: mocks.and,
	db: {},
	eq: mocks.eq,
	isNull: mocks.isNull,
	receivedAmounts: {
		deletedAt: "deletedAt",
		id: "id",
		organizationId: "organizationId",
	},
	sql: mocks.sql,
}));

import { getLockedReceivedPayment } from "./received-payment-lock";

describe("getLockedReceivedPayment", () => {
	it("locks the tenant-scoped row before re-reading it in the transaction", async () => {
		const events: string[] = [];
		const received = { id: "payment_1" };
		const tx = {
			execute: vi.fn(async () => {
				events.push("lock");
			}),
			query: {
				receivedAmounts: {
					findFirst: vi.fn(async () => {
						events.push("read");
						return received;
					}),
				},
			},
		};

		await expect(
			getLockedReceivedPayment(tx as never, {
				organizationId: "org_1",
				receivedAmountId: "payment_1",
			}),
		).resolves.toBe(received);

		expect(events).toEqual(["lock", "read"]);
		expect(mocks.sql.mock.calls[0]?.[0]?.join("")).toContain("FOR UPDATE");
	});
});
