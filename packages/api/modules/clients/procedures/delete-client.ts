import { ORPCError } from "@orpc/server";
import { and, eq, clients, db } from "@repo/database";
import { studioProtectedProcedure } from "../../../orpc/procedures";
import { requirePermission } from "../../studio/lib/permissions";
import {
	deleteClientInputSchema,
	deleteClientOutputSchema,
} from "../../studio/schemas/client";

export const deleteClient = studioProtectedProcedure
	.route({
		method: "DELETE",
		path: "/clients/{id}",
		tags: ["Clients"],
		summary: "Delete client",
		description: "Soft delete a client (sets deletedAt timestamp)",
	})
	.input(deleteClientInputSchema)
	.output(deleteClientOutputSchema)
	.handler(async ({ input, context }) => {
		requirePermission(context, "client", "delete");

		const { id } = input;

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

		// Check if already deleted
		if (existing.deletedAt) {
			throw new ORPCError("CONFLICT", {
				message: "Client is already deleted",
			});
		}

		// Soft delete client
		await db
			.update(clients)
			.set({
				deletedAt: new Date(),
				deletedBy: context.user.id,
				updatedAt: new Date(),
				updatedBy: context.user.id,
			})
			.where(eq(clients.id, id));

		return {
			data: { id },
			message: "Client deleted successfully",
		};
	});
