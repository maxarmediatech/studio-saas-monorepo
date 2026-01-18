import { ORPCError } from "@orpc/client";
import { and, db, eq, ne, organizationRoles } from "@repo/database";
import { z } from "zod";
import { studioProtectedProcedure } from "../../../orpc/procedures";
import { requirePermission } from "../../studio/lib/permissions";

const permissionSchema = z.record(z.string(), z.array(z.string()));

export const updateRole = studioProtectedProcedure
	.route({
		method: "PATCH",
		path: "/organizations/roles/{roleId}",
		tags: ["Organizations", "Roles"],
		summary: "Update custom role",
		description: "Update an existing custom role",
	})
	.input(
		z.object({
			roleId: z.string(),
			role: z
				.string()
				.min(1)
				.max(50)
				.regex(
					/^[a-z][a-z0-9_]*$/,
					"Role name must start with a letter and contain only lowercase letters, numbers, and underscores",
				)
				.optional(),
			permission: permissionSchema.optional(),
			description: z.string().max(255).optional().nullable(),
			color: z
				.string()
				.regex(/^#[0-9A-Fa-f]{6}$/)
				.optional(),
		}),
	)
	.output(
		z.object({
			id: z.string(),
			role: z.string(),
			permission: z.string(),
			description: z.string().nullable(),
			color: z.string().nullable(),
			updatedAt: z.date().nullable(),
		}),
	)
	.handler(async ({ input, context }) => {
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

		if (input.role && input.role !== existingRole.role) {
			const duplicateName = await db.query.organizationRoles.findFirst({
				where: and(
					eq(
						organizationRoles.organizationId,
						context.organizationId,
					),
					eq(organizationRoles.role, input.role),
					ne(organizationRoles.id, input.roleId),
				),
			});

			if (duplicateName) {
				throw new ORPCError("CONFLICT", {
					message: `Role "${input.role}" already exists`,
				});
			}
		}

		const updateData: Partial<typeof organizationRoles.$inferInsert> = {};

		if (input.role !== undefined) updateData.role = input.role;
		if (input.permission !== undefined)
			updateData.permission = JSON.stringify(input.permission);
		if (input.description !== undefined)
			updateData.description = input.description;
		if (input.color !== undefined) updateData.color = input.color;

		const [updated] = await db
			.update(organizationRoles)
			.set(updateData)
			.where(eq(organizationRoles.id, input.roleId))
			.returning();

		if (!updated) {
			throw new ORPCError("INTERNAL_SERVER_ERROR", {
				message: "Failed to update role",
			});
		}

		return updated;
	});
