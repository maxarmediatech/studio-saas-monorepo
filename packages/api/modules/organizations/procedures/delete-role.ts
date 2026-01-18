import { ORPCError } from "@orpc/client";
import { and, db, eq, members, organizationRoles } from "@repo/database";
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

		const membersWithRole = await db.query.members.findMany({
			where: and(
				eq(members.organizationId, context.organizationId),
				eq(members.role, existingRole.role),
			),
			limit: 1,
		});

		if (membersWithRole.length > 0) {
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
