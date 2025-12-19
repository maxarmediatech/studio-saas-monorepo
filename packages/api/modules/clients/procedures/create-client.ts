import { ORPCError } from "@orpc/server";
import { and, eq, isNull, or, clients, db } from "@repo/database";
import { studioProtectedProcedure } from "../../../orpc/procedures";
import { requirePermission } from "../../studio/lib/permissions";
import {
	createClientInputSchema,
	createClientOutputSchema,
} from "../../studio/schemas/client";

export const createClient = studioProtectedProcedure
	.route({
		method: "POST",
		path: "/clients",
		tags: ["Clients"],
		summary: "Create client",
		description: "Create a new client for the organization",
	})
	.input(createClientInputSchema)
	.output(createClientOutputSchema)
	.handler(async ({ input, context }) => {
		requirePermission(context, "client", "create");

		const { name, email, phoneNumber, alternatePhone, address, metadata } = input;

		// Check for duplicate phone or email within organization
		if (email || phoneNumber) {
			const duplicateConditions = [];

			if (email) {
				duplicateConditions.push(eq(clients.email, email));
			}
			if (phoneNumber) {
				duplicateConditions.push(eq(clients.phoneNumber, phoneNumber));
			}

			const existing = await db.query.clients.findFirst({
				where: and(
					eq(clients.organizationId, context.organizationId),
					isNull(clients.deletedAt),
					or(...duplicateConditions),
				),
			});

			if (existing) {
				if (email && existing.email === email) {
					throw new ORPCError("CONFLICT", {
						message: `A client with email '${email}' already exists`,
					});
				}
				if (phoneNumber && existing.phoneNumber === phoneNumber) {
					throw new ORPCError("CONFLICT", {
						message: `A client with phone number '${phoneNumber}' already exists`,
					});
				}
			}
		}

		// Create client
		const [created] = await db
			.insert(clients)
			.values({
				organizationId: context.organizationId,
				name,
				email: email ?? null,
				phoneNumber: phoneNumber ?? null,
				alternatePhone: alternatePhone ?? null,
				address: address ?? null,
				metadata: metadata ?? null,
				createdBy: context.user.id,
			})
			.returning({ id: clients.id });

		if (!created) {
			throw new ORPCError("INTERNAL_SERVER_ERROR", {
				message: "Failed to create client",
			});
		}

		return {
			data: { id: created.id },
			message: "Client created successfully",
		};
	});
