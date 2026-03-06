import { isProfileOnlyRole } from "@repo/auth/lib/permissions";
import { db, eq, organizationRoles } from "@repo/database";
import { z } from "zod";
import { studioProtectedProcedure } from "../../../orpc/procedures";
import { requireOrganizationAdmin } from "../../studio/lib/permissions";

export const listRoles = studioProtectedProcedure
	.route({
		method: "GET",
		path: "/organizations/roles",
		tags: ["Organizations", "Roles"],
		summary: "List organization roles",
		description: "List all custom roles for the active organization",
	})
	.output(
		z.array(
			z.object({
				id: z.string(),
				role: z.string(),
				permission: z.string(),
				description: z.string().nullable(),
				color: z.string().nullable(),
				createdAt: z.date(),
				updatedAt: z.date().nullable(),
			}),
		),
	)
	.handler(async ({ context }) => {
		requireOrganizationAdmin(context);
		const roles = await db.query.organizationRoles.findMany({
			where: eq(organizationRoles.organizationId, context.organizationId),
			orderBy: (roles, { asc }) => [asc(roles.role)],
		});

		return roles.filter((role) => !isProfileOnlyRole(role.role));
	});
