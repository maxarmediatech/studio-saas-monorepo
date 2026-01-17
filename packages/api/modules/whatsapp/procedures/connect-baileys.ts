import { ORPCError } from "@orpc/server";
import { db } from "@repo/database";
import { waAccounts } from "@repo/whatsapp-db";
import { studioProtectedProcedure } from "../../../orpc/procedures";
import {
	connectBaileysInputSchema,
	connectBaileysOutputSchema,
} from "../types";

export const connectBaileys = studioProtectedProcedure
	.route({
		method: "POST",
		path: "/whatsapp/accounts/connect-baileys",
		tags: ["WhatsApp"],
		summary: "Connect WhatsApp via QR",
	})
	.input(connectBaileysInputSchema)
	.output(connectBaileysOutputSchema)
	.handler(async ({ input, context }) => {
		const [created] = await db
			.insert(waAccounts)
			.values({
				organizationId: context.organizationId,
				name: input.name,
				provider: "baileys",
				connectionStatus: "qr_pending",
				ownershipType: "platform",
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
