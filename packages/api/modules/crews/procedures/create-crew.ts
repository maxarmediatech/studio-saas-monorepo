import { ORPCError } from "@orpc/server";
import { and, eq, isNull, crews, db } from "@repo/database";
import { studioProtectedProcedure } from "../../../orpc/procedures";
import { requirePermission } from "../../studio/lib/permissions";
import {
	createCrewInputSchema,
	createCrewOutputSchema,
} from "../../studio/schemas/crew";

export const createCrew = studioProtectedProcedure
	.route({
		method: "POST",
		path: "/crews",
		tags: ["Crews"],
		summary: "Create crew",
		description: "Create a new crew member for the organization",
	})
	.input(createCrewInputSchema)
	.output(createCrewOutputSchema)
	.handler(async ({ input, context }) => {
		requirePermission(context, "crew", "create");

		const { name, email, phoneNumber, role, status, dailyRate, metadata } = input;

		// Check for duplicate phone within organization
		if (phoneNumber) {
			const existing = await db.query.crews.findFirst({
				where: and(
					eq(crews.organizationId, context.organizationId),
					eq(crews.phoneNumber, phoneNumber),
					isNull(crews.deletedAt),
				),
			});

			if (existing) {
				throw new ORPCError("CONFLICT", {
					message: `A crew member with phone number '${phoneNumber}' already exists`,
				});
			}
		}

		// Create crew
		const [created] = await db
			.insert(crews)
			.values({
				organizationId: context.organizationId,
				name,
				email: email ?? null,
				phoneNumber: phoneNumber ?? null,
				role,
				status: status ?? "active",
				dailyRate: dailyRate ?? null,
				metadata: metadata ?? null,
				createdBy: context.user.id,
			})
			.returning({ id: crews.id });

		if (!created) {
			throw new ORPCError("INTERNAL_SERVER_ERROR", {
				message: "Failed to create crew member",
			});
		}

		return {
			data: { id: created.id },
			message: "Crew member created successfully",
		};
	});
