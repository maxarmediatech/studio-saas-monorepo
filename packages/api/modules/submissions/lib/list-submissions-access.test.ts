import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ListSubmissionsInput } from "../../studio/schemas/submission";
import { assertListSubmissionsAccess } from "./list-submissions-access";

const mocks = vi.hoisted(() => ({
	mockHasPermission: vi.fn(),
}));

vi.mock("../../studio/lib/permissions", async () => {
	return {
		hasPermission: mocks.mockHasPermission,
	};
});

const context = {
	headers: new Headers(),
};

const baseInput: ListSubmissionsInput = {
	page: 1,
	limit: 20,
	pendingReviewOnly: false,
	sortBy: "submittedAt",
	sortDirection: "desc",
};

describe("assertListSubmissionsAccess", () => {
	beforeEach(() => {
		vi.resetAllMocks();
	});

	it("allows review queue users", async () => {
		mocks.mockHasPermission.mockResolvedValueOnce(true);

		await expect(
			assertListSubmissionsAccess(baseInput, context),
		).resolves.toBeUndefined();
		expect(mocks.mockHasPermission).toHaveBeenCalledTimes(1);
	});

	it("allows task-scoped access for task readers", async () => {
		mocks.mockHasPermission
			.mockResolvedValueOnce(false)
			.mockResolvedValueOnce(true);

		await expect(
			assertListSubmissionsAccess(
				{ ...baseInput, taskId: "task_1" },
				context,
			),
		).resolves.toBeUndefined();
		expect(mocks.mockHasPermission).toHaveBeenCalledTimes(2);
	});

	it("allows deliverable-scoped access for deliverable readers", async () => {
		mocks.mockHasPermission
			.mockResolvedValueOnce(false)
			.mockResolvedValueOnce(false)
			.mockResolvedValueOnce(true);

		await expect(
			assertListSubmissionsAccess(
				{ ...baseInput, deliverableId: "del_1" },
				context,
			),
		).resolves.toBeUndefined();
		expect(mocks.mockHasPermission).toHaveBeenCalledTimes(3);
	});

	it("rejects broad non-review access", async () => {
		mocks.mockHasPermission.mockResolvedValue(false);

		await expect(
			assertListSubmissionsAccess(baseInput, context),
		).rejects.toMatchObject({
			code: "FORBIDDEN",
		});
	});

	it("rejects booking-scoped non-review access", async () => {
		mocks.mockHasPermission.mockResolvedValue(false);

		await expect(
			assertListSubmissionsAccess(
				{ ...baseInput, bookingId: "booking_1" },
				context,
			),
		).rejects.toMatchObject({
			code: "FORBIDDEN",
		});
	});
});
