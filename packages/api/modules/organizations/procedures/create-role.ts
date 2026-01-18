import { ORPCError } from "@orpc/client";
import { isStaticRole } from "@repo/auth/lib/permissions";
import { and, db, eq, organizationRoles } from "@repo/database";
import { z } from "zod";
import { studioProtectedProcedure } from "../../../orpc/procedures";
import {
	requireOrganizationAdmin,
	requirePermission,
} from "../../studio/lib/permissions";

const permissionSchema = z.record(z.string(), z.array(z.string()));

export const createRole = studioProtectedProcedure
	.route({
		method: "POST",
		path: "/organizations/roles",
		tags: ["Organizations", "Roles"],
		summary: "Create custom role",
		description: "Create a new custom role for the organization",
	})
	.input(
		z.object({
			role: z
				.string()
				.min(1)
				.max(50)
				.regex(
					/^[a-z][a-z0-9_]*$/,
					"Role name must start with a letter and contain only lowercase letters, numbers, and underscores",
				),
			permission: permissionSchema,
			description: z.string().max(255).optional(),
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
			createdAt: z.date(),
		}),
	)
	.handler(async ({ input, context }) => {
		requireOrganizationAdmin(context);
		await requirePermission(context, "settings", "update");

		if (isStaticRole(input.role)) {
			throw new ORPCError("BAD_REQUEST", {
				message: "Role name is reserved for a system role",
			});
		}

		const existingRole = await db.query.organizationRoles.findFirst({
			where: and(
				eq(organizationRoles.organizationId, context.organizationId),
				eq(organizationRoles.role, input.role),
			),
		});

		if (existingRole) {
			throw new ORPCError("CONFLICT", {
				message: `Role "${input.role}" already exists`,
			});
		}

		const roleCount = await db.query.organizationRoles.findMany({
			where: eq(organizationRoles.organizationId, context.organizationId),
			columns: { id: true },
		});

		if (roleCount.length >= 20) {
			throw new ORPCError("BAD_REQUEST", {
				message: "Maximum number of custom roles (20) reached",
			});
		}

		const [newRole] = await db
			.insert(organizationRoles)
			.values({
				organizationId: context.organizationId,
				role: input.role,
				permission: JSON.stringify(input.permission),
				description: input.description ?? null,
				color: input.color ?? "#6366f1",
			})
			.returning();

		if (!newRole) {
			throw new ORPCError("INTERNAL_SERVER_ERROR", {
				message: "Failed to create role",
			});
		}

		return newRole;
	});
