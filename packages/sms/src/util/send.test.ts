import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockInsertValues, mockInsert, mockSelectWhere, mockSelect } =
	vi.hoisted(() => {
		const mockInsertValues = vi.fn();
		const mockInsert = vi.fn(() => ({
			values: mockInsertValues,
		}));
		const mockSelectWhere = vi.fn();
		const mockSelect = vi.fn(() => ({
			from: () => ({
				where: mockSelectWhere,
			}),
		}));
		return {
			mockInsertValues,
			mockInsert,
			mockSelectWhere,
			mockSelect,
		};
	});

vi.mock("@repo/database", () => ({
	and: vi.fn(),
	db: {
		insert: mockInsert,
		select: mockSelect,
	},
	eq: vi.fn(),
	gte: vi.fn(),
	inArray: vi.fn(),
	smsOutbox: {
		id: "id",
		organizationId: "organizationId",
		phoneNumber: "phoneNumber",
		templateId: "templateId",
		variables: "variables",
		status: "status",
		createdAt: "createdAt",
	},
}));

vi.mock("@repo/logs", () => ({
	logger: {
		error: vi.fn(),
		info: vi.fn(),
	},
}));

import { queueSms } from "./send";

describe("queueSms", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockSelectWhere.mockResolvedValue([]);
		mockInsertValues.mockResolvedValue(undefined);
	});

	it("rejects invalid phone numbers before insert", async () => {
		await expect(
			queueSms({
				organizationId: "org-1",
				phoneNumber: "not-a-phone",
				templateId: "flow-1",
				variables: { VAR1: "hello" },
			}),
		).rejects.toThrow(/Phone number is invalid/);

		expect(mockInsert).not.toHaveBeenCalled();
	});

	it("skips duplicate messages within dedupe window", async () => {
		mockSelectWhere.mockResolvedValue([
			{
				id: "sms-1",
				variables: { VAR2: "x", VAR1: "hello" },
			},
		]);

		await queueSms({
			organizationId: "org-1",
			phoneNumber: "+91 9876543210",
			templateId: "flow-1",
			variables: { VAR1: "hello", VAR2: "x" },
		});

		expect(mockInsert).not.toHaveBeenCalled();
	});

	it("inserts normalized phone when not duplicate", async () => {
		await queueSms({
			organizationId: "org-1",
			phoneNumber: "9876543210",
			templateId: "flow-1",
			variables: { VAR1: "hello" },
		});

		expect(mockInsert).toHaveBeenCalledTimes(1);
		expect(mockInsertValues).toHaveBeenCalledWith(
			expect.objectContaining({
				organizationId: "org-1",
				phoneNumber: "919876543210",
				templateId: "flow-1",
				status: "pending",
				attempts: 0,
				maxAttempts: 3,
			}),
		);
	});
});
