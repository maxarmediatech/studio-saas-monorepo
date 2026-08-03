import { describe, expect, it, vi } from "vitest";
import type { TransactionClient } from "../../../studio/lib/transactions";
import { generateBookingReferenceNumber } from "../generate-reference-number";

function transactionWithLastReference(referenceNumber?: string) {
	const order: string[] = [];
	const limit = vi.fn(async () =>
		referenceNumber ? [{ referenceNumber }] : [],
	);
	const tx = {
		execute: vi.fn(async () => {
			order.push("lock");
		}),
		select: vi.fn(() => {
			order.push("select");
			return {
				from: () => ({
					where: () => ({ orderBy: () => ({ limit }) }),
				}),
			};
		}),
	} as unknown as TransactionClient;
	return { tx, order, limit };
}

describe("generateBookingReferenceNumber", () => {
	it("takes a transaction-scoped advisory lock before reading the monthly max", async () => {
		const { tx, order } = transactionWithLastReference("SO-2604-0041");

		const reference = await generateBookingReferenceNumber(
			tx,
			"organization-1",
			"Studio One",
			new Date("2026-04-15T00:00:00.000Z"),
		);

		expect(reference).toBe("SO-2604-0042");
		expect(order).toEqual(["lock", "select"]);
		expect(tx.execute).toHaveBeenCalledOnce();
	});

	it("starts the tenant-month sequence at one", async () => {
		const { tx } = transactionWithLastReference();

		await expect(
			generateBookingReferenceNumber(
				tx,
				"organization-1",
				"Studio One",
				new Date("2026-04-15T00:00:00.000Z"),
			),
		).resolves.toBe("SO-2604-0001");
	});
});
