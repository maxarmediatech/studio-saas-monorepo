import { ORPCError } from "@orpc/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	mockRequirePermission: vi.fn(),
	mockExecuteBulkInviteBatch: vi.fn(),
	procedureChain: (() => {
		const chain = {
			route: vi.fn(() => chain),
			input: vi.fn(() => chain),
			output: vi.fn(() => chain),
			handler: vi.fn(() => chain),
		};

		return chain;
	})(),
}));

vi.mock("../../studio/lib/permissions", () => ({
	requirePermission: mocks.mockRequirePermission,
}));

vi.mock("../../../orpc/procedures", () => ({
	studioProtectedProcedure: mocks.procedureChain,
}));

vi.mock("../lib/bulk-invite-service", () => ({
	executeBulkInviteBatch: mocks.mockExecuteBulkInviteBatch,
}));

vi.mock("@repo/auth", () => ({
	auth: {
		api: {
			createInvitation: vi.fn(),
		},
	},
}));

vi.mock("@repo/database", () => ({
	db: {
		select: vi.fn(),
		query: {
			invitations: {
				findMany: vi.fn(),
			},
		},
	},
	and: vi.fn((...args) => args),
	eq: vi.fn((a, b) => ({ eq: [a, b] })),
	inArray: vi.fn((a, b) => ({ inArray: [a, b] })),
	invitations: {
		organizationId: "organizationId",
		status: "status",
		email: "email",
	},
	members: {
		organizationId: "organizationId",
		userId: "userId",
	},
	users: {
		id: "id",
		email: "email",
	},
}));

import { createBulkInvitations } from "./bulk-create-invitations";

const baseInput = {
	emails: ["alice@example.com"],
	role: ["member"],
	teamId: null,
};

const baseContext = {
	headers: new Headers(),
	organizationId: "org_1",
};

describe("createBulkInvitations", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("requires invite create permission before executing the batch", async () => {
		mocks.mockRequirePermission.mockRejectedValue(
			new ORPCError("FORBIDDEN"),
		);

		await expect(
			createBulkInvitations(baseInput, baseContext),
		).rejects.toSatisfy((error: unknown) => {
			expect(error).toBeInstanceOf(ORPCError);
			expect((error as { code?: string }).code).toBe("FORBIDDEN");
			return true;
		});

		expect(mocks.mockRequirePermission).toHaveBeenCalledWith(
			baseContext,
			"invites",
			"create",
		);
		expect(mocks.mockExecuteBulkInviteBatch).not.toHaveBeenCalled();
	});

	it("delegates to the batch executor after permission passes", async () => {
		const expected = {
			summary: {
				requested: 1,
				normalized: 1,
				created: 1,
				skipped: 0,
				failed: 0,
			},
			results: [
				{
					email: "alice@example.com",
					status: "created",
					invitationId: "inv_1",
				},
			],
		};
		mocks.mockRequirePermission.mockResolvedValue(undefined);
		mocks.mockExecuteBulkInviteBatch.mockResolvedValue(expected);

		await expect(
			createBulkInvitations(baseInput, baseContext),
		).resolves.toEqual(expected);
		expect(mocks.mockExecuteBulkInviteBatch).toHaveBeenCalledOnce();
	});
});
