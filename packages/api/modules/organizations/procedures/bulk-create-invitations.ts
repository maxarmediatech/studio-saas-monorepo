import { ORPCError } from "@orpc/server";
import { auth, OrganizationInvitationEmailDeliveryError } from "@repo/auth";
import {
	and,
	db,
	eq,
	inArray,
	invitations,
	members,
	users,
} from "@repo/database";
import { logger } from "@repo/logs";
import { assertTransactionalEmailDeliveryReady } from "@repo/mail";
import { studioProtectedProcedure } from "../../../orpc/procedures";
import { requirePermission } from "../../studio/lib/permissions";
import {
	type BulkInviteInput,
	BulkInviteLimitError,
	bulkInviteInputSchema,
	bulkInviteOutputSchema,
} from "../lib/bulk-invitations";
import { executeBulkInviteBatch } from "../lib/bulk-invite-service";

type CreateInvitationInput = NonNullable<
	Parameters<typeof auth.api.createInvitation>[0]
>;

interface BulkCreateInvitationsContext {
	headers: Headers;
	organizationId: string;
}

async function cancelInvitationCreatedDuringFailedBulkInvite({
	email,
	invitationId,
	organizationId,
}: {
	email: string;
	invitationId: string;
	organizationId: string;
}) {
	try {
		await db
			.update(invitations)
			.set({
				status: "canceled",
			})
			.where(
				and(
					eq(invitations.id, invitationId),
					eq(invitations.organizationId, organizationId),
					eq(invitations.status, "pending"),
				),
			);
		logger.warn("organizations.bulk_invite.canceled_failed_invitation", {
			email,
			invitationId,
			organizationId,
		});
		return true;
	} catch (rollbackError) {
		logger.error("organizations.bulk_invite.rollback_failed", {
			email,
			error: rollbackError,
			invitationId,
			organizationId,
		});
		return false;
	}
}

export async function createBulkInvitations(
	input: BulkInviteInput,
	context: BulkCreateInvitationsContext,
) {
	await requirePermission(context, "invites", "create");

	try {
		return await executeBulkInviteBatch(input, {
			findExistingMemberEmails: async (emails) => {
				if (emails.length === 0) {
					return [];
				}

				const rows = await db
					.select({
						email: users.email,
					})
					.from(members)
					.innerJoin(users, eq(members.userId, users.id))
					.where(
						and(
							eq(members.organizationId, context.organizationId),
							inArray(users.email, emails),
						),
					);

				return rows.map((row) => row.email);
			},
			findPendingInvitations: async (emails) => {
				if (emails.length === 0) {
					return [];
				}

				const rows = await db.query.invitations.findMany({
					where: and(
						eq(invitations.organizationId, context.organizationId),
						eq(invitations.status, "pending"),
						inArray(invitations.email, emails),
					),
					columns: {
						id: true,
						email: true,
					},
				});

				return rows.map((row) => ({
					email: row.email,
					invitationId: row.id,
				}));
			},
			beforeCreateInvitation: async ({ email }) => {
				try {
					assertTransactionalEmailDeliveryReady();
				} catch (error) {
					const message =
						error instanceof Error
							? error.message
							: "Check email delivery configuration and try again.";
					logger.error(
						"organizations.bulk_invite.delivery_not_ready",
						{
							email,
							error,
							organizationId: context.organizationId,
						},
					);
					throw new Error(
						`Email delivery is not ready, so no invitation was created. ${message}`,
					);
				}
			},
			createInvitation: async ({ email, role, teamId }) => {
				try {
					return await auth.api.createInvitation({
						headers: context.headers,
						body: {
							email,
							role,
							organizationId: context.organizationId,
							teamId: teamId ?? undefined,
							resend: false,
						},
					} as CreateInvitationInput);
				} catch (error) {
					if (
						!(
							error instanceof
							OrganizationInvitationEmailDeliveryError
						)
					) {
						throw error;
					}

					const rollbackSucceeded =
						await cancelInvitationCreatedDuringFailedBulkInvite({
							email,
							invitationId: error.invitationId,
							organizationId: context.organizationId,
						});
					const reason = error.reason;

					throw new Error(
						rollbackSucceeded
							? reason
								? `Invitation email could not be delivered, and the pending invitation was canceled. ${reason}`
								: "Invitation email could not be delivered, and the pending invitation was canceled."
							: reason
								? `Invitation email could not be delivered, and the pending invitation could not be canceled automatically. Please revoke it manually and try again. ${reason}`
								: "Invitation email could not be delivered, and the pending invitation could not be canceled automatically. Please revoke it manually and try again.",
					);
				}
			},
		});
	} catch (error) {
		if (error instanceof BulkInviteLimitError) {
			throw new ORPCError("BAD_REQUEST", {
				message: error.message,
			});
		}

		throw error;
	}
}

export const bulkCreateInvitations = studioProtectedProcedure
	.route({
		method: "POST",
		path: "/organizations/invites/bulk",
		tags: ["Organizations", "Invites"],
		summary: "Bulk create invitations",
		description:
			"Create organization invitations for a small batch of email addresses",
	})
	.input(bulkInviteInputSchema)
	.output(bulkInviteOutputSchema)
	.handler(async ({ input, context }) =>
		createBulkInvitations(input, context),
	);
