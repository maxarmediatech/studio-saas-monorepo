import { and, db, eq, isNull } from "@repo/database";
import { waAccounts } from "@repo/whatsapp-db";
import type { WhatsAppTransactionClient } from "./transaction-client";

export const findActiveWhatsAppAccount = async (
	organizationId: string,
	accountId: string,
	executor: typeof db | WhatsAppTransactionClient = db,
) =>
	executor.query.waAccounts.findFirst({
		where: and(
			eq(waAccounts.organizationId, organizationId),
			eq(waAccounts.id, accountId),
			isNull(waAccounts.deletedAt),
		),
	});
