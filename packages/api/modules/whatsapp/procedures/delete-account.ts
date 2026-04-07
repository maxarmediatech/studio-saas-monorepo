import { ORPCError } from "@orpc/server";
import { db, eq } from "@repo/database";
import { waAccounts } from "@repo/whatsapp-db";
import { studioProtectedProcedure } from "../../../orpc/procedures";
import { findActiveWhatsAppAccount } from "../lib/account-repository";
import { deleteAccountInputSchema, deleteAccountOutputSchema } from "../types";

export const deleteAccount = studioProtectedProcedure
	.route({
		method: "DELETE",
		path: "/whatsapp/accounts/:accountId",
		tags: ["WhatsApp"],
		summary: "Disconnect WhatsApp account",
	})
	.input(deleteAccountInputSchema)
	.output(deleteAccountOutputSchema)
	.handler(async ({ input, context }) => {
		const account = await findActiveWhatsAppAccount(
			context.organizationId,
			input.accountId,
		);

		if (!account) {
			throw new ORPCError("NOT_FOUND", {
				message: "WhatsApp account not found",
			});
		}

		const [deleted] = await db
			.update(waAccounts)
			.set({
				connectionStatus: "disconnected",
				deletedAt: new Date(),
				lastErrorMessage: null,
			})
			.where(eq(waAccounts.id, account.id))
			.returning({ id: waAccounts.id });

		if (!deleted) {
			throw new ORPCError("INTERNAL_SERVER_ERROR", {
				message: "Failed to disconnect WhatsApp account",
			});
		}

		return {
			data: { id: deleted.id },
			message: "WhatsApp account disconnected",
		};
	});
