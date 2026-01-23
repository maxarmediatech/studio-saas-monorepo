import { ORPCError } from "@orpc/client";
import { normalizeRoles } from "@repo/auth/lib/permissions";
import { and, db, eq, ilike, members, organizationRoles } from "@repo/database";
import { z } from "zod";
import { studioProtectedProcedure } from "../../../orpc/procedures";
import {
	requireOrganizationAdmin,
	requirePermission,
} from "../../studio/lib/permissions";

export const deleteRole = studioProtectedProcedure
	.route({
		method: "DELETE",
		path: "/organizations/roles/{roleId}",
		tags: ["Organizations", "Roles"],
		summary: "Delete custom role",
		description: "Delete a custom role from the organization",
	})
	.input(
		z.object({
			roleId: z.string(),
		}),
	)
	.output(z.object({ success: z.boolean() }))
	.handler(async ({ input, context }) => {
		requireOrganizationAdmin(context);
		await requirePermission(context, "settings", "update");

		const existingRole = await db.query.organizationRoles.findFirst({
			where: and(
				eq(organizationRoles.id, input.roleId),
				eq(organizationRoles.organizationId, context.organizationId),
			),
		});

		if (!existingRole) {
			throw new ORPCError("NOT_FOUND", {
				message: "Role not found",
			});
		}

		const memberCandidates = await db.query.members.findMany({
			where: and(
				eq(members.organizationId, context.organizationId),
				ilike(members.role, `%${existingRole.role}%`),
			),
			columns: { role: true },
			limit: 25,
		});

		const roleInUse = memberCandidates.some((member) =>
			normalizeRoles(member.role).includes(existingRole.role),
		);

		if (roleInUse) {
			throw new ORPCError("BAD_REQUEST", {
				message:
					"Cannot delete role that is assigned to members. Please reassign members first.",
			});
		}

		await db
			.delete(organizationRoles)
			.where(eq(organizationRoles.id, input.roleId));

		return { success: true };
	});
