import type { db } from "@repo/database";

export type WhatsAppTransactionClient = Parameters<
	Parameters<typeof db.transaction>[0]
>[0];
