import { ORPCError } from "@orpc/server";
import { studioProtectedProcedure } from "../../../orpc/procedures";
import { toWhatsAppAccountSummary } from "../lib/account-presenter";
import { findActiveWhatsAppAccount } from "../lib/account-repository";
import { getAccountInputSchema, getAccountOutputSchema } from "../types";

export const getAccount = studioProtectedProcedure
	.route({
		method: "GET",
		path: "/whatsapp/accounts/:accountId",
		tags: ["WhatsApp"],
		summary: "Get WhatsApp account",
	})
	.input(getAccountInputSchema)
	.output(getAccountOutputSchema)
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

		return {
			data: toWhatsAppAccountSummary(account),
		};
	});
