import { ORPCError } from "@orpc/client";
import { isStaticRole, normalizeRoles, serializeRoles } from "@repo/auth/lib/permissions";
import {
	and,
	db,
	eq,
	ilike,
	invitations,
	members,
	ne,
	organizationRoles,
} from "@repo/database";
import { z } from "zod";
import { studioProtectedProcedure } from "../../../orpc/procedures";
import {
	requireOrganizationAdmin,
	requirePermission,
} from "../../studio/lib/permissions";

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

		if (input.role && input.role !== existingRole.role) {
			if (isStaticRole(input.role)) {
				throw new ORPCError("BAD_REQUEST", {
					message: "Role name is reserved for a system role",
				});
			}

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
		const shouldRenameRole =
			input.role !== undefined && input.role !== existingRole.role;

		if (input.role !== undefined) updateData.role = input.role;
		if (input.permission !== undefined)
			updateData.permission = JSON.stringify(input.permission);
		if (input.description !== undefined)
			updateData.description = input.description;
		if (input.color !== undefined) updateData.color = input.color;

		const updated = await db.transaction(async (tx) => {
			const [updatedRole] = await tx
				.update(organizationRoles)
				.set(updateData)
				.where(eq(organizationRoles.id, input.roleId))
				.returning();

			if (!updatedRole) {
				return null;
			}

			if (shouldRenameRole) {
				const nextRoleName = input.role ?? existingRole.role;
				const membersToUpdate = await tx.query.members.findMany({
					where: and(
						eq(members.organizationId, context.organizationId),
						ilike(members.role, `%${existingRole.role}%`),
					),
					columns: { id: true, role: true },
				});

				for (const memberRow of membersToUpdate) {
					const nextRoles = normalizeRoles(memberRow.role).map((role) =>
						role === existingRole.role ? nextRoleName : role,
					);
					const nextRole = serializeRoles(nextRoles);
					if (nextRole !== memberRow.role) {
						await tx
							.update(members)
							.set({ role: nextRole })
							.where(eq(members.id, memberRow.id));
					}
				}

				const invitationsToUpdate = await tx.query.invitations.findMany({
					where: and(
						eq(invitations.organizationId, context.organizationId),
						ilike(invitations.role, `%${existingRole.role}%`),
					),
					columns: { id: true, role: true },
				});

				for (const invitationRow of invitationsToUpdate) {
					if (!invitationRow.role) {
						continue;
					}
					const nextRoles = normalizeRoles(invitationRow.role).map(
						(role) => (role === existingRole.role ? nextRoleName : role),
					);
					const nextRole = serializeRoles(nextRoles);
					if (nextRole !== invitationRow.role) {
						await tx
							.update(invitations)
							.set({ role: nextRole })
							.where(eq(invitations.id, invitationRow.id));
					}
				}
			}

			return updatedRole;
		});

		if (!updated) {
			throw new ORPCError("INTERNAL_SERVER_ERROR", {
				message: "Failed to update role",
			});
		}

		return updated;
	});
