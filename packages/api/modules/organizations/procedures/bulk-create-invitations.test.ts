import { ORPCError } from "@orpc/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	mockRequirePermission: vi.fn(),
	mockExecuteBulkInviteBatch: vi.fn(),
	mockAssertTransactionalEmailDeliveryReady: vi.fn(),
	mockCreateInvitation: vi.fn(),
	mockDbUpdateWhere: vi.fn(),
	mockDbUpdateSet: vi.fn(),
	mockDbUpdate: vi.fn(),
	MockOrganizationInvitationEmailDeliveryError: class MockOrganizationInvitationEmailDeliveryError extends Error {
		email: string;
		invitationId: string;
		organizationId: string;
		reason: string | null;

		constructor({
			email,
			invitationId,
			organizationId,
			cause,
		}: {
			email: string;
			invitationId: string;
			organizationId: string;
			cause: unknown;
		}) {
			const reason = cause instanceof Error ? cause.message : null;
			super(
				reason
					? `Invitation email could not be delivered. ${reason}`
					: "Invitation email could not be delivered.",
			);
			this.name = "OrganizationInvitationEmailDeliveryError";
			this.email = email;
			this.invitationId = invitationId;
			this.organizationId = organizationId;
			this.reason = reason;
		}
	},
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

vi.mock("@repo/mail", () => ({
	assertTransactionalEmailDeliveryReady:
		mocks.mockAssertTransactionalEmailDeliveryReady,
}));

vi.mock("@repo/auth", () => ({
	OrganizationInvitationEmailDeliveryError:
		mocks.MockOrganizationInvitationEmailDeliveryError,
	auth: {
		api: {
			createInvitation: mocks.mockCreateInvitation,
		},
	},
}));

vi.mock("@repo/database", () => ({
	db: {
		select: vi.fn(),
		update: mocks.mockDbUpdate,
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
		id: "id",
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
		mocks.mockAssertTransactionalEmailDeliveryReady.mockImplementation(
			() => undefined,
		);
		mocks.mockDbUpdateSet.mockImplementation(() => ({
			where: mocks.mockDbUpdateWhere,
		}));
		mocks.mockDbUpdate.mockImplementation(() => ({
			set: mocks.mockDbUpdateSet,
		}));
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

	it("surfaces a clear no-invitation-created message when email delivery is not ready", async () => {
		mocks.mockRequirePermission.mockResolvedValue(undefined);
		mocks.mockAssertTransactionalEmailDeliveryReady.mockImplementation(
			() => {
				throw new Error(
					"Email app URLs must be public. Set EMAIL_BASE_URL to your public Stuwiz domain instead of localhost.",
				);
			},
		);
		mocks.mockExecuteBulkInviteBatch.mockImplementation(
			async (_input, deps) => {
				await deps.beforeCreateInvitation?.({
					email: "alice@example.com",
					role: ["member"],
					teamId: null,
				});

				return {
					summary: {
						requested: 0,
						normalized: 0,
						created: 0,
						skipped: 0,
						failed: 0,
					},
					results: [],
				};
			},
		);

		await expect(
			createBulkInvitations(baseInput, baseContext),
		).rejects.toThrow(
			"Email delivery is not ready, so no invitation was created. Email app URLs must be public. Set EMAIL_BASE_URL to your public Stuwiz domain instead of localhost.",
		);
	});

	it("cancels only the newly created invitation when email delivery fails after creation", async () => {
		mocks.mockRequirePermission.mockResolvedValue(undefined);
		mocks.mockCreateInvitation.mockRejectedValue(
			new mocks.MockOrganizationInvitationEmailDeliveryError({
				email: "alice@example.com",
				invitationId: "inv_rollback",
				organizationId: "org_1",
				cause: new Error("Could not send email via Resend."),
			}),
		);
		mocks.mockExecuteBulkInviteBatch.mockImplementation(
			async (_input, deps) => {
				await deps.createInvitation({
					email: "alice@example.com",
					role: ["member"],
					teamId: null,
				});

				return {
					summary: {
						requested: 0,
						normalized: 0,
						created: 0,
						skipped: 0,
						failed: 0,
					},
					results: [],
				};
			},
		);

		await expect(
			createBulkInvitations(baseInput, baseContext),
		).rejects.toThrow(
			"Invitation email could not be delivered, and the pending invitation was canceled. Could not send email via Resend.",
		);
		expect(mocks.mockDbUpdate).toHaveBeenCalledOnce();
		expect(mocks.mockDbUpdateWhere).toHaveBeenCalledOnce();
	});

	it("does not cancel invitations for non-delivery create errors", async () => {
		mocks.mockRequirePermission.mockResolvedValue(undefined);
		mocks.mockCreateInvitation.mockRejectedValue(new Error("boom"));
		mocks.mockExecuteBulkInviteBatch.mockImplementation(
			async (_input, deps) => {
				await deps.createInvitation({
					email: "alice@example.com",
					role: ["member"],
					teamId: null,
				});

				return {
					summary: {
						requested: 0,
						normalized: 0,
						created: 0,
						skipped: 0,
						failed: 0,
					},
					results: [],
				};
			},
		);

		await expect(
			createBulkInvitations(baseInput, baseContext),
		).rejects.toThrow("boom");
		expect(mocks.mockDbUpdate).not.toHaveBeenCalled();
	});
});
