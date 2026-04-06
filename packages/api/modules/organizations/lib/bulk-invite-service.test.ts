import { describe, expect, it, vi } from "vitest";
import { BulkInviteLimitError } from "./bulk-invitations";
import { executeBulkInviteBatch } from "./bulk-invite-service";

describe("executeBulkInviteBatch", () => {
	it("creates all valid invitations", async () => {
		const createInvitation = vi
			.fn()
			.mockResolvedValueOnce({ id: "inv_1" })
			.mockResolvedValueOnce({ id: "inv_2" });

		const result = await executeBulkInviteBatch(
			{
				emails: ["alice@example.com", "bob@example.com"],
				role: ["member"],
				teamId: null,
			},
			{
				findExistingMemberEmails: vi.fn().mockResolvedValue([]),
				findPendingInvitations: vi.fn().mockResolvedValue([]),
				createInvitation,
			},
		);

		expect(result.summary).toEqual({
			requested: 2,
			normalized: 2,
			created: 2,
			skipped: 0,
			failed: 0,
		});
		expect(result.results).toEqual([
			{
				email: "alice@example.com",
				status: "created",
				invitationId: "inv_1",
			},
			{
				email: "bob@example.com",
				status: "created",
				invitationId: "inv_2",
			},
		]);
	});

	it("returns mixed statuses and keeps processing", async () => {
		const createInvitation = vi
			.fn()
			.mockResolvedValueOnce({ id: "inv_1" })
			.mockRejectedValueOnce(
				Object.assign(
					new Error(
						"You are not allowed to invite a user with this role",
					),
					{
						code: "FORBIDDEN",
					},
				),
			);

		const result = await executeBulkInviteBatch(
			{
				emails: [
					"alice@example.com",
					"member@example.com",
					"pending@example.com",
					"invalid-email",
					"alice@example.com",
					"owner@example.com",
				],
				role: ["member"],
				teamId: null,
			},
			{
				findExistingMemberEmails: vi
					.fn()
					.mockResolvedValue(["member@example.com"]),
				findPendingInvitations: vi.fn().mockResolvedValue([
					{
						email: "pending@example.com",
						invitationId: "inv_pending",
					},
				]),
				createInvitation,
			},
		);

		expect(result.summary).toEqual({
			requested: 6,
			normalized: 4,
			created: 1,
			skipped: 4,
			failed: 1,
		});
		expect(result.results).toEqual([
			{
				email: "alice@example.com",
				status: "created",
				invitationId: "inv_1",
			},
			{
				email: "member@example.com",
				status: "already_member",
			},
			{
				email: "pending@example.com",
				status: "already_invited",
				invitationId: "inv_pending",
			},
			{
				email: "invalid-email",
				status: "invalid_email",
			},
			{
				email: "alice@example.com",
				status: "duplicate_in_batch",
			},
			{
				email: "owner@example.com",
				status: "forbidden",
				code: "FORBIDDEN",
				message: "You are not allowed to invite a user with this role",
			},
		]);
	});

	it("maps limit errors from the invite dependency", async () => {
		const result = await executeBulkInviteBatch(
			{
				emails: ["alice@example.com"],
				role: ["member"],
				teamId: null,
			},
			{
				findExistingMemberEmails: vi.fn().mockResolvedValue([]),
				findPendingInvitations: vi.fn().mockResolvedValue([]),
				createInvitation: vi
					.fn()
					.mockRejectedValue(new Error("Invitation limit reached")),
			},
		);

		expect(result.summary.failed).toBe(1);
		expect(result.results[0]).toMatchObject({
			email: "alice@example.com",
			status: "limit_reached",
		});
	});

	it("fails ready emails before persistence when delivery preflight is not ready", async () => {
		const createInvitation = vi.fn();

		const result = await executeBulkInviteBatch(
			{
				emails: ["alice@example.com"],
				role: ["member"],
				teamId: null,
			},
			{
				findExistingMemberEmails: vi.fn().mockResolvedValue([]),
				findPendingInvitations: vi.fn().mockResolvedValue([]),
				beforeCreateInvitation: vi
					.fn()
					.mockRejectedValue(
						new Error(
							"Email app URLs must be public. Set EMAIL_BASE_URL to your public Stuwiz domain instead of localhost.",
						),
					),
				createInvitation,
			},
		);

		expect(createInvitation).not.toHaveBeenCalled();
		expect(result.summary).toEqual({
			requested: 1,
			normalized: 1,
			created: 0,
			skipped: 0,
			failed: 1,
		});
		expect(result.results).toEqual([
			{
				email: "alice@example.com",
				status: "failed",
				message:
					"Email app URLs must be public. Set EMAIL_BASE_URL to your public Stuwiz domain instead of localhost.",
			},
		]);
	});

	it("throws when the unique valid limit is exceeded", async () => {
		await expect(
			executeBulkInviteBatch(
				{
					emails: Array.from(
						{ length: 11 },
						(_, index) => `person${index + 1}@example.com`,
					),
					role: ["member"],
					teamId: null,
				},
				{
					findExistingMemberEmails: vi.fn().mockResolvedValue([]),
					findPendingInvitations: vi.fn().mockResolvedValue([]),
					createInvitation: vi.fn(),
				},
			),
		).rejects.toBeInstanceOf(BulkInviteLimitError);
	});
});
