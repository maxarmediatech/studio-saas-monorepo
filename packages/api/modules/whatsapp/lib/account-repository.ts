import { and, db, eq, isNull } from "@repo/database";
import { waAccounts } from "@repo/whatsapp-db";

export const findActiveWhatsAppAccount = async (
	organizationId: string,
	accountId: string,
) =>
	db.query.waAccounts.findFirst({
		where: and(
			eq(waAccounts.organizationId, organizationId),
			eq(waAccounts.id, accountId),
			isNull(waAccounts.deletedAt),
		),
	});
