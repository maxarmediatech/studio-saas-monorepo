import type { WhatsAppProvider } from "@repo/whatsapp-core";
import type {
	waAccounts,
	waContacts,
	waMedia,
	waMessages,
	waOutbox,
} from "@repo/whatsapp-db";

export type WhatsAppOutboxItem = {
	outbox: typeof waOutbox.$inferSelect;
	message: typeof waMessages.$inferSelect;
	account: typeof waAccounts.$inferSelect;
	contact: typeof waContacts.$inferSelect;
	media: typeof waMedia.$inferSelect | null;
};

export type ProviderFactory = (item: WhatsAppOutboxItem) => WhatsAppProvider;
