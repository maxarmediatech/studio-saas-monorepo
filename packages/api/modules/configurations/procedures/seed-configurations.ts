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
			"Seed missing default configurations for the organization and backfill null metadata on existing defaults.",
	})
	.input(seedConfigurationsInputSchema)
	.output(seedConfigurationsOutputSchema)
	.handler(async ({ input, context }) => {
		await requirePermission(context, "configuration", "create");

		const typesToSeed =
			input.types ?? (Object.keys(defaultConfigurations) as ConfigType[]);

		return await withTransaction(async (tx) => {
			let seededCount = 0;
			let metadataBackfilledCount = 0;
			const seededTypes: ConfigType[] = [];

			for (const configType of typesToSeed) {
				const existing = await tx.query.configurations.findMany({
					where: and(
						eq(
							configurations.organizationId,
							context.organizationId,
						),
						eq(configurations.type, configType),
					),
				});

				const defaults = defaultConfigurations[configType];
				if (!defaults || defaults.length === 0) {
					continue;
				}

				const existingByKey = new Map(existing.map((config) => [config.key, config]));
				const hasDefaultInExisting = existing.some((config) => config.isDefault);
				let touchedType = false;

				// Insert missing default configurations for this type
				const valuesToInsert = defaults
					.filter((item) => !existingByKey.has(item.key))
					.map(
						(item: DefaultConfigItem, index: number) => ({
							organizationId: context.organizationId,
							type: configType,
							key: item.key,
							label: item.label,
							description: item.description ?? null,
							color: item.color ?? null,
							icon: item.icon ?? null,
							sortOrder: existing.length + index,
							isDefault: hasDefaultInExisting
								? false
								: (item.isDefault ?? false),
							isSystem: false,
							isActive: true,
							metadata: item.metadata ?? null,
							defaultCost: null,
							bookingTypeFilter: null,
						}),
					);

				if (valuesToInsert.length > 0) {
					await tx.insert(configurations).values(valuesToInsert);
					seededCount += valuesToInsert.length;
					touchedType = true;
				}

				// Backfill metadata for existing defaults where metadata was previously null.
				for (const item of defaults) {
					if (!item.metadata) continue;
					const current = existingByKey.get(item.key);
					if (!current || current.metadata !== null) continue;

					await tx
						.update(configurations)
						.set({
							metadata: item.metadata,
							updatedAt: new Date(),
						})
						.where(
							and(
								eq(configurations.id, current.id),
								eq(configurations.organizationId, context.organizationId),
							),
						);

					metadataBackfilledCount += 1;
					touchedType = true;
				}

				if (touchedType) {
					seededTypes.push(configType);
				}
			}

			const summaryParts: string[] = [];
			if (seededCount > 0) {
				summaryParts.push(`Seeded ${seededCount} configurations`);
			}
			if (metadataBackfilledCount > 0) {
				summaryParts.push(
					`backfilled metadata for ${metadataBackfilledCount} configurations`,
				);
			}

			return {
				data: {
					seededCount,
					types: seededTypes,
				},
				message: summaryParts.length
					? `${summaryParts.join(" and ")} across ${seededTypes.length} types`
					: "No configurations needed - all types already configured",
			};
		});
	});
