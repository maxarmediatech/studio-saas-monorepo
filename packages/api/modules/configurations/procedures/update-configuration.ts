import { ORPCError } from "@orpc/server";
import { and, configurations, eq } from "@repo/database";
import { studioProtectedProcedure } from "../../../orpc/procedures";
import { requirePermission } from "../../studio/lib/permissions";
import { withTransaction } from "../../studio/lib/transactions";
import {
	updateConfigurationInputSchema,
	updateConfigurationOutputSchema,
} from "../../studio/schemas/configuration";
import { validateConfigurationFields } from "../lib/validate-configuration";

export const updateConfiguration = studioProtectedProcedure
	.route({
		method: "PUT",
		path: "/configurations/{id}",
		tags: ["Configurations"],
		summary: "Update configuration",
		description: "Update an existing configuration item",
	})
	.input(updateConfigurationInputSchema)
	.output(updateConfigurationOutputSchema)
	.handler(async ({ input, context }) => {
		await requirePermission(context, "configuration", "update");

		const {
			id,
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
			// Verify configuration exists and belongs to organization
			const existing = await tx.query.configurations.findFirst({
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
			if (
				existing.type === "quotation_terms" &&
				existing.isDefault &&
				(isDefault === false || isActive === false)
			) {
				throw new ORPCError("BAD_REQUEST", {
					message:
						"Choose another default quotation terms preset before disabling this one",
				});
			}

			const validatedMetadata = await validateConfigurationFields(
				tx,
				context.organizationId,
				existing.type,
				metadata === undefined
					? (existing.metadata as Record<string, unknown> | null)
					: metadata,
				bookingTypeFilter === undefined
					? existing.bookingTypeFilter
					: bookingTypeFilter,
			);

			// System configurations cannot be modified (except sortOrder and isActive)
			if (existing.isSystem) {
				const onlyAllowedChanges =
					label === undefined &&
					description === undefined &&
					color === undefined &&
					icon === undefined &&
					isDefault === undefined &&
					metadata === undefined &&
					defaultCost === undefined &&
					bookingTypeFilter === undefined;

				if (!onlyAllowedChanges) {
					throw new ORPCError("FORBIDDEN", {
						message: "System configurations cannot be modified",
					});
				}
			}

			// If this is being marked as default, unset other defaults for this type
			if (isDefault === true && !existing.isDefault) {
				await tx
					.update(configurations)
					.set({ isDefault: false, updatedAt: new Date() })
					.where(
						and(
							eq(
								configurations.organizationId,
								context.organizationId,
							),
							eq(configurations.type, existing.type),
							eq(configurations.isDefault, true),
						),
					);
			}

			// Build update object
			const updates: Partial<typeof configurations.$inferInsert> = {
				updatedAt: new Date(),
			};

			if (label !== undefined) {
				updates.label = label;
			}
			if (description !== undefined) {
				updates.description = description;
			}
			if (color !== undefined) {
				updates.color = color;
			}
			if (icon !== undefined) {
				updates.icon = icon;
			}
			if (sortOrder !== undefined) {
				updates.sortOrder = sortOrder;
			}
			if (isDefault !== undefined) {
				updates.isDefault = isDefault;
			}
			if (isActive !== undefined) {
				updates.isActive = isActive;
			}
			if (metadata !== undefined) {
				updates.metadata = validatedMetadata;
			}
			if (defaultCost !== undefined) {
				updates.defaultCost = defaultCost;
			}
			if (bookingTypeFilter !== undefined) {
				updates.bookingTypeFilter = bookingTypeFilter;
			}
			if (existing.type === "quotation_terms" && isDefault === true) {
				updates.isActive = true;
			}

			await tx
				.update(configurations)
				.set(updates)
				.where(eq(configurations.id, id));

			return {
				data: { id },
				message: "Configuration updated successfully",
			};
		});
	});
