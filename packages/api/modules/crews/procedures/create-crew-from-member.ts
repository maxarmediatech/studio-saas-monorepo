import { ORPCError } from "@orpc/server";
import { and, eq, isNull, members, users, crews, db } from "@repo/database";
import { studioProtectedProcedure } from "../../../orpc/procedures";
import { requirePermission } from "../../studio/lib/permissions";
import {
	createCrewFromMemberInputSchema,
	createCrewFromMemberOutputSchema,
} from "../../studio/schemas/crew";

export const createCrewFromMember = studioProtectedProcedure
	.route({
		method: "POST",
		path: "/crews/from-member",
		tags: ["Crews"],
		summary: "Create crew from member",
		description: "Create a crew profile linked to an organization member's user account",
	})
	.input(createCrewFromMemberInputSchema)
	.output(createCrewFromMemberOutputSchema)
	.handler(async ({ input, context }) => {
		requirePermission(context, "crew", "create");

		const { memberId, role, dailyRate } = input;

		// Verify member exists and belongs to organization
		const member = await db.query.members.findFirst({
			where: and(
				eq(members.id, memberId),
				eq(members.organizationId, context.organizationId),
			),
			with: {
				user: true,
			},
		});

		if (!member) {
			throw new ORPCError("NOT_FOUND", {
				message: "Organization member not found",
			});
		}

		// Check if crew already exists for this user in this organization
		const existingCrew = await db.query.crews.findFirst({
			where: and(
				eq(crews.organizationId, context.organizationId),
				eq(crews.userId, member.userId),
				isNull(crews.deletedAt),
			),
		});

		if (existingCrew) {
			throw new ORPCError("CONFLICT", {
				message: "A crew profile already exists for this member",
			});
		}

		// Get user details
		const user = await db.query.users.findFirst({
			where: eq(users.id, member.userId),
		});

		if (!user) {
			throw new ORPCError("NOT_FOUND", {
				message: "User not found",
			});
		}

		// Create crew linked to user
		const [created] = await db
			.insert(crews)
			.values({
				organizationId: context.organizationId,
				userId: user.id,
				name: user.name,
				email: user.email,
				phoneNumber: null,
				role,
				status: "active",
				dailyRate: dailyRate ?? null,
				metadata: null,
				createdBy: context.user.id,
			})
			.returning({ id: crews.id });

		if (!created) {
			throw new ORPCError("INTERNAL_SERVER_ERROR", {
				message: "Failed to create crew profile",
			});
		}

		return {
			data: { id: created.id },
			message: "Crew profile created from member successfully",
		};
	});
