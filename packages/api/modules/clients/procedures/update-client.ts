import { ORPCError } from "@orpc/server";
import { and, clients, db, eq, isNull, ne, or } from "@repo/database";
import { studioProtectedProcedure } from "../../../orpc/procedures";
import { detectChanges, safeTrackFieldChanges } from "../../activities/lib";
import { requirePermission } from "../../studio/lib/permissions";
import {
	updateClientInputSchema,
	updateClientOutputSchema,
} from "../../studio/schemas/client";

export const updateClient = studioProtectedProcedure
	.route({
		method: "PUT",
		path: "/clients/{id}",
		tags: ["Clients"],
		summary: "Update client",
		description: "Update an existing client",
	})
	.input(updateClientInputSchema)
	.output(updateClientOutputSchema)
	.handler(async ({ input, context }) => {
		await requirePermission(context, "client", "update");

		const {
			id,
			name,
			email,
			phoneNumber,
			alternatePhone,
			address,
			metadata,
		} = input;

		// Verify client exists and belongs to organization
		const existing = await db.query.clients.findFirst({
			where: and(
				eq(clients.id, id),
				eq(clients.organizationId, context.organizationId),
			),
		});

		if (!existing) {
			throw new ORPCError("NOT_FOUND", {
				message: "Client not found",
			});
		}

		// Check for duplicate phone or email (excluding current client)
		if (email !== undefined || phoneNumber !== undefined) {
			const duplicateConditions = [];

			if (email !== undefined && email !== null) {
				duplicateConditions.push(eq(clients.email, email));
			}
			if (phoneNumber !== undefined && phoneNumber !== null) {
				duplicateConditions.push(eq(clients.phoneNumber, phoneNumber));
			}

			if (duplicateConditions.length > 0) {
				const duplicate = await db.query.clients.findFirst({
					where: and(
						eq(clients.organizationId, context.organizationId),
						isNull(clients.deletedAt),
						ne(clients.id, id),
						or(...duplicateConditions),
					),
				});

				if (duplicate) {
					if (email && duplicate.email === email) {
						throw new ORPCError("CONFLICT", {
							message: `A client with email '${email}' already exists`,
						});
					}
					if (phoneNumber && duplicate.phoneNumber === phoneNumber) {
						throw new ORPCError("CONFLICT", {
							message: `A client with phone number '${phoneNumber}' already exists`,
						});
					}
				}
			}
		}

		// Build update object
		const updates: Partial<typeof clients.$inferInsert> = {
			updatedAt: new Date(),
			updatedBy: context.user.id,
		};

		if (name !== undefined) {
			updates.name = name;
		}
		if (email !== undefined) {
			updates.email = email;
		}
		if (phoneNumber !== undefined) {
			updates.phoneNumber = phoneNumber;
		}
		if (alternatePhone !== undefined) {
			updates.alternatePhone = alternatePhone;
		}
		if (address !== undefined) {
			updates.address = address;
		}
		if (metadata !== undefined) {
			updates.metadata = metadata;
		}

		await db.update(clients).set(updates).where(eq(clients.id, id));

		// Track activity (non-blocking)
		const changes = detectChanges(existing, input, [
			"name",
			"email",
			"phoneNumber",
			"address",
		]);
		if (changes.length > 0) {
			await safeTrackFieldChanges(context, {
				entityType: "client",
				entityId: id,
				entityName: input.name ?? existing.name,
				changes,
			});
		}

		return {
			data: { id },
			message: "Client updated successfully",
		};
	});
