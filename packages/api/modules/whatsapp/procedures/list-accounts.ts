import { and, db, eq, isNull } from "@repo/database";
import { waAccounts } from "@repo/whatsapp-db";
import { studioProtectedProcedure } from "../../../orpc/procedures";
import { toWhatsAppAccountSummary } from "../lib/account-presenter";
import { listAccountsInputSchema, listAccountsOutputSchema } from "../types";

export const listAccounts = studioProtectedProcedure
	.route({
		method: "GET",
		path: "/whatsapp/accounts",
		tags: ["WhatsApp"],
		summary: "List WhatsApp accounts",
	})
	.input(listAccountsInputSchema)
	.output(listAccountsOutputSchema)
	.handler(async ({ context }) => {
		const accounts = await db.query.waAccounts.findMany({
			where: and(
				eq(waAccounts.organizationId, context.organizationId),
				isNull(waAccounts.deletedAt),
			),
			orderBy: (fields, { desc }) => [desc(fields.createdAt)],
		});

		return {
			data: accounts.map(toWhatsAppAccountSummary),
		};
	});
