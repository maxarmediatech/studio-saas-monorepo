import { ORPCError } from "@orpc/server";
import { and, eq, configurations, db } from "@repo/database";
import { studioProtectedProcedure } from "../../../orpc/procedures";
import { requirePermission } from "../../studio/lib/permissions";
import {
	getConfigurationInputSchema,
	getConfigurationOutputSchema,
} from "../../studio/schemas/configuration";

export const getConfiguration = studioProtectedProcedure
	.route({
		method: "GET",
		path: "/configurations/{id}",
		tags: ["Configurations"],
		summary: "Get configuration",
		description: "Get a single configuration by ID",
	})
	.input(getConfigurationInputSchema)
	.output(getConfigurationOutputSchema)
	.handler(async ({ input, context }) => {
		requirePermission(context, "configuration", "read");

		const config = await db.query.configurations.findFirst({
			where: and(
				eq(configurations.id, input.id),
				eq(configurations.organizationId, context.organizationId),
			),
		});

		if (!config) {
			throw new ORPCError("NOT_FOUND", {
				message: "Configuration not found",
			});
		}

		return {
			data: {
				...config,
				metadata: config.metadata as Record<string, unknown> | null,
				createdAt: config.createdAt.toISOString(),
				updatedAt: config.updatedAt.toISOString(),
			},
		};
	});
