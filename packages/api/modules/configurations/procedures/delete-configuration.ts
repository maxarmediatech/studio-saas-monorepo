import { ORPCError } from "@orpc/server";
import { and, configurations, db, eq } from "@repo/database";
import { studioProtectedProcedure } from "../../../orpc/procedures";
import { requirePermission } from "../../studio/lib/permissions";
import {
	deleteConfigurationInputSchema,
	deleteConfigurationOutputSchema,
} from "../../studio/schemas/configuration";

export const deleteConfiguration = studioProtectedProcedure
	.route({
		method: "DELETE",
		path: "/configurations/{id}",
		tags: ["Configurations"],
		summary: "Delete configuration",
		description:
			"Delete a configuration item (system configurations cannot be deleted)",
	})
	.input(deleteConfigurationInputSchema)
	.output(deleteConfigurationOutputSchema)
	.handler(async ({ input, context }) => {
		await requirePermission(context, "configuration", "delete");

		const { id } = input;

		// Verify configuration exists and belongs to organization
		const existing = await db.query.configurations.findFirst({
			where: and(
				eq(configurations.id, id),
				eq(configurations.organizationId, context.organizationId),
			),
		});

		if (!existing) {
			throw new ORPCError("NOT_FOUND", {
				message: "Configuration not found",
			});
		}

		// System configurations cannot be deleted
		if (existing.isSystem) {
			throw new ORPCError("FORBIDDEN", {
				message: "System configurations cannot be deleted",
			});
		}
		if (existing.type === "quotation_terms" && existing.isDefault) {
			throw new ORPCError("BAD_REQUEST", {
				message:
					"Choose another default quotation terms preset before deleting this one",
			});
		}

		// Delete configuration
		await db.delete(configurations).where(eq(configurations.id, id));

		return {
			data: { id },
			message: "Configuration deleted successfully",
		};
	});
