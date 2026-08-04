import { ORPCError } from "@orpc/server";
import { and, configurations, eq } from "@repo/database";
import { studioProtectedProcedure } from "../../../orpc/procedures";
import { requirePermission } from "../../studio/lib/permissions";
import { withTransaction } from "../../studio/lib/transactions";
import {
	createConfigurationInputSchema,
	createConfigurationOutputSchema,
} from "../../studio/schemas/configuration";
import { validateConfigurationFields } from "../lib/validate-configuration";

export const createConfiguration = studioProtectedProcedure
	.route({
		method: "POST",
		path: "/configurations",
		tags: ["Configurations"],
		summary: "Create configuration",
		description: "Create a new configuration item for the organization",
	})
	.input(createConfigurationInputSchema)
	.output(createConfigurationOutputSchema)
	.handler(async ({ input, context }) => {
		await requirePermission(context, "configuration", "create");

		const {
			type,
			key,
			label,
			description,
			color,
			icon,
			sortOrder,
			isDefault,
			isActive,
			metadata,
			defaultCost,
			bookingTypeFilter,
		} = input;

		return await withTransaction(async (tx) => {
			const validatedMetadata = await validateConfigurationFields(
				tx,
				context.organizationId,
				type,
				metadata,
				bookingTypeFilter,
			);
			// Check for duplicate key within same type
			const existing = await tx.query.configurations.findFirst({
				where: and(
					eq(configurations.organizationId, context.organizationId),
					eq(configurations.type, type),
					eq(configurations.key, key),
				),
			});

			if (existing) {
				throw new ORPCError("CONFLICT", {
					message: `Configuration with key '${key}' already exists for type '${type}'`,
				});
			}
			const existingDefault =
				type === "quotation_terms"
					? await tx.query.configurations.findFirst({
							where: and(
								eq(
									configurations.organizationId,
									context.organizationId,
								),
								eq(configurations.type, type),
								eq(configurations.isDefault, true),
							),
							columns: { id: true },
						})
					: null;
			const shouldBeDefault =
				type === "quotation_terms"
					? Boolean(isDefault || !existingDefault)
					: isDefault;

			// If this is marked as default, unset other defaults for this type
			if (shouldBeDefault) {
				await tx
					.update(configurations)
					.set({ isDefault: false, updatedAt: new Date() })
					.where(
						and(
							eq(
								configurations.organizationId,
								context.organizationId,
							),
							eq(configurations.type, type),
							eq(configurations.isDefault, true),
						),
					);
			}

			// Get next sort order if not provided
			let finalSortOrder = sortOrder;
			if (finalSortOrder === undefined) {
				const lastConfig = await tx.query.configurations.findFirst({
					where: and(
						eq(
							configurations.organizationId,
							context.organizationId,
						),
						eq(configurations.type, type),
					),
					orderBy: (table, { desc }) => [desc(table.sortOrder)],
				});
				finalSortOrder = (lastConfig?.sortOrder ?? -1) + 1;
			}

			// Create configuration
			const [created] = await tx
				.insert(configurations)
				.values({
					organizationId: context.organizationId,
					type,
					key,
					label,
					description: description ?? null,
					color: color ?? null,
					icon: icon ?? null,
					sortOrder: finalSortOrder,
					isDefault: shouldBeDefault ?? false,
					isSystem: false,
					isActive: shouldBeDefault ? true : (isActive ?? true),
					metadata: validatedMetadata ?? null,
					defaultCost: defaultCost ?? null,
					bookingTypeFilter: bookingTypeFilter ?? null,
				})
				.returning({ id: configurations.id });

			if (!created) {
				throw new ORPCError("INTERNAL_SERVER_ERROR", {
					message: "Failed to create configuration",
				});
			}

			return {
				data: { id: created.id },
				message: "Configuration created successfully",
			};
		});
	});
