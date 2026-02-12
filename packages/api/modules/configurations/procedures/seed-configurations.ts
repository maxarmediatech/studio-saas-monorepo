import { and, configurations, eq } from "@repo/database";
import { studioProtectedProcedure } from "../../../orpc/procedures";
import { requirePermission } from "../../studio/lib/permissions";
import { withTransaction } from "../../studio/lib/transactions";
import type { ConfigType } from "../../studio/schemas/common";
import {
	type DefaultConfigItem,
	defaultConfigurations,
	seedConfigurationsInputSchema,
	seedConfigurationsOutputSchema,
} from "../../studio/schemas/configuration";

export const seedConfigurations = studioProtectedProcedure
	.route({
		method: "POST",
		path: "/configurations/seed",
		tags: ["Configurations"],
		summary: "Seed configurations",
		description:
			"Seed default configurations for the organization. Skips types that already have configurations.",
	})
	.input(seedConfigurationsInputSchema)
	.output(seedConfigurationsOutputSchema)
	.handler(async ({ input, context }) => {
		await requirePermission(context, "configuration", "create");

		const typesToSeed =
			input.types ?? (Object.keys(defaultConfigurations) as ConfigType[]);

		return await withTransaction(async (tx) => {
			let seededCount = 0;
			const seededTypes: ConfigType[] = [];

			for (const configType of typesToSeed) {
				// Check if this type already has configurations
				const existing = await tx.query.configurations.findFirst({
					where: and(
						eq(
							configurations.organizationId,
							context.organizationId,
						),
						eq(configurations.type, configType),
					),
				});

				if (existing) {
					// Skip - this type is already configured
					continue;
				}

				const defaults = defaultConfigurations[configType];
				if (!defaults || defaults.length === 0) {
					continue;
				}

				// Insert default configurations for this type
				const valuesToInsert = defaults.map(
					(item: DefaultConfigItem, index: number) => ({
						organizationId: context.organizationId,
						type: configType,
						key: item.key,
						label: item.label,
						description: item.description ?? null,
						color: item.color ?? null,
						icon: item.icon ?? null,
						sortOrder: index,
						isDefault: item.isDefault ?? false,
						isSystem: false,
						isActive: true,
						metadata: null,
						defaultCost: null,
						bookingTypeFilter: null,
					}),
				);

				await tx.insert(configurations).values(valuesToInsert);

				seededCount += valuesToInsert.length;
				seededTypes.push(configType);
			}

			return {
				data: {
					seededCount,
					types: seededTypes,
				},
				message:
					seededCount > 0
						? `Seeded ${seededCount} configurations across ${seededTypes.length} types`
						: "No configurations needed - all types already configured",
			};
		});
	});
