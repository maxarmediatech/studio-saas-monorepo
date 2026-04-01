import { ORPCError } from "@orpc/server";
import { auth } from "@repo/auth";
import {
	and,
	db,
	eq,
	inArray,
	invitations,
	members,
	users,
} from "@repo/database";
import { studioProtectedProcedure } from "../../../orpc/procedures";
import {
	BulkInviteLimitError,
	type BulkInviteInput,
	bulkInviteInputSchema,
	bulkInviteOutputSchema,
} from "../lib/bulk-invitations";
import { executeBulkInviteBatch } from "../lib/bulk-invite-service";
import { requirePermission } from "../../studio/lib/permissions";

type CreateInvitationInput = NonNullable<
	Parameters<typeof auth.api.createInvitation>[0]
>;

interface BulkCreateInvitationsContext {
	headers: Headers;
	organizationId: string;
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
			createInvitation: async ({ email, role, teamId }) => {
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
