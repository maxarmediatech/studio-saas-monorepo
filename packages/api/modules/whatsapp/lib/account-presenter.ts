import type { waAccounts } from "@repo/whatsapp-db";

type WhatsAppAccountRecord = typeof waAccounts.$inferSelect;

export const toWhatsAppAccountSummary = (account: WhatsAppAccountRecord) => ({
	id: account.id,
	name: account.name,
	provider: account.provider,
	connectionStatus: account.connectionStatus,
	ownershipType: account.ownershipType,
	phoneNumber: account.phoneNumber ?? null,
	displayPhoneNumber: account.displayPhoneNumber ?? null,
	phoneNumberId: account.phoneNumberId ?? null,
	wabaId: account.wabaId ?? null,
	apiVersion: account.apiVersion ?? null,
	verifiedName: account.verifiedName ?? null,
	qualityRating: account.qualityRating ?? null,
	messagingLimitTier: account.messagingLimitTier ?? null,
	lastConnectedAt: account.lastConnectedAt ?? null,
	lastValidatedAt: account.lastValidatedAt ?? null,
	lastEventAt: account.lastEventAt ?? null,
	lastErrorMessage: account.lastErrorMessage ?? null,
	errorCount: account.errorCount ?? 0,
	hasAccessToken: Boolean(account.accessToken),
	hasAppSecret: Boolean(account.appSecret),
	createdAt: account.createdAt,
	updatedAt: account.updatedAt,
});
