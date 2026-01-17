import { ORPCError } from "@orpc/server";
import { db } from "@repo/database";
import { waAccounts } from "@repo/whatsapp-db";
import { studioProtectedProcedure } from "../../../orpc/procedures";
import {
	connectCloudApiInputSchema,
	connectCloudApiOutputSchema,
} from "../types";

export const connectCloudApi = studioProtectedProcedure
	.route({
		method: "POST",
		path: "/whatsapp/accounts/connect-cloud-api",
		tags: ["WhatsApp"],
		summary: "Connect WhatsApp Cloud API",
	})
	.input(connectCloudApiInputSchema)
	.output(connectCloudApiOutputSchema)
	.handler(async ({ input, context }) => {
		const [created] = await db
			.insert(waAccounts)
			.values({
				organizationId: context.organizationId,
				name: input.name,
				provider: "cloud_api",
				connectionStatus: "connected",
				ownershipType: "customer",
				phoneNumberId: input.phoneNumberId,
				wabaId: input.wabaId ?? null,
				accessToken: input.accessToken,
				webhookVerifyToken: input.webhookVerifyToken,
			})
			.returning({ id: waAccounts.id });

		if (!created) {
			throw new ORPCError("INTERNAL_SERVER_ERROR", {
				message: "Failed to create WhatsApp account",
			});
		}

		return {
			data: { id: created.id },
			message: "WhatsApp account created",
		};
	});
