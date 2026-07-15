import { describe, expect, it, vi } from "vitest";
import {
	isDocumentNumberUniqueConflict,
	retryDocumentNumberInsert,
} from "./document-number-service";

describe("document number conflict handling", () => {
	it("classifies exact constraints through wrapped driver errors", () => {
		expect(
			isDocumentNumberUniqueConflict(
				{
					cause: {
						code: "23505",
						constraint_name: "invoices_org_number_idx",
					},
				},
				"invoices_org_number_idx",
			),
		).toBe(true);
	});

	it("does not classify unrelated uniqueness failures", () => {
		expect(
			isDocumentNumberUniqueConflict(
				{
					code: "23505",
					constraint: "invoices_active_payment_schedule_idx",
				},
				"invoices_org_number_idx",
			),
		).toBe(false);
	});

	it("repairs between attempts and stops at the configured bound", async () => {
		const conflict = {
			code: "23505",
			constraint: "bookings_org_ref_idx",
		};
		const attempt = vi.fn().mockRejectedValue(conflict);
		const repairSequenceFloor = vi.fn().mockResolvedValue(undefined);

		await expect(
			retryDocumentNumberInsert({
				attempt,
				repairSequenceFloor,
				constraintName: "bookings_org_ref_idx",
				maxAttempts: 3,
			}),
		).rejects.toBe(conflict);
		expect(attempt).toHaveBeenCalledTimes(3);
		expect(repairSequenceFloor).toHaveBeenCalledTimes(2);
	});

	it("surfaces unrelated failures without repair or retry", async () => {
		const conflict = {
			code: "23505",
			constraint: "bookings_id_org_idx",
		};
		const attempt = vi.fn().mockRejectedValue(conflict);
		const repairSequenceFloor = vi.fn().mockResolvedValue(undefined);

		await expect(
			retryDocumentNumberInsert({
				attempt,
				repairSequenceFloor,
				constraintName: "bookings_org_ref_idx",
			}),
		).rejects.toBe(conflict);
		expect(attempt).toHaveBeenCalledOnce();
		expect(repairSequenceFloor).not.toHaveBeenCalled();
	});
});
