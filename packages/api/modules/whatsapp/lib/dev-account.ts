import { and, db, eq, isNull } from "@repo/database";
import { env } from "@repo/env";
import { waAccounts } from "@repo/whatsapp-db";
import { encryptWhatsAppSecret } from "./account-secrets";

function getDevAccountConfig() {
	if (process.env.NODE_ENV === "production") {
		return null;
	}

	const phoneNumberId = env.WHATSAPP_DEV_PHONE_NUMBER_ID?.trim();
	const wabaId = env.WHATSAPP_DEV_WABA_ID?.trim();
	const accessToken = env.WHATSAPP_DEV_ACCESS_TOKEN?.trim();

	if (!phoneNumberId || !wabaId || !accessToken) {
		return null;
	}

	return {
		name: env.WHATSAPP_DEV_ACCOUNT_NAME?.trim() || "WhatsApp test number",
		phoneNumberId,
		wabaId,
		accessToken,
		displayPhoneNumber:
			env.WHATSAPP_DEV_DISPLAY_PHONE_NUMBER?.trim() || null,
		apiVersion: env.WHATSAPP_DEV_API_VERSION?.trim() || "v22.0",
	};
}

function serializeDevAccessToken(accessToken: string) {
	if (!process.env.INTEGRATIONS_TOKEN_ENCRYPTION_KEY) {
		return accessToken;
	}

	return encryptWhatsAppSecret(accessToken);
}

export async function ensureDevWhatsAppAccount(organizationId: string) {
	const config = getDevAccountConfig();
	if (!config) {
		return;
	}

	const existing = await db.query.waAccounts.findFirst({
		where: and(
			eq(waAccounts.organizationId, organizationId),
			eq(waAccounts.phoneNumberId, config.phoneNumberId),
			isNull(waAccounts.deletedAt),
		),
	});

	const now = new Date();
	const values = {
		name: config.name,
		phoneNumber: config.displayPhoneNumber,
		displayPhoneNumber: config.displayPhoneNumber,
		provider: "cloud_api" as const,
		connectionStatus: "connected" as const,
		ownershipType: "customer" as const,
		apiVersion: config.apiVersion,
		phoneNumberId: config.phoneNumberId,
		wabaId: config.wabaId,
		accessToken: serializeDevAccessToken(config.accessToken),
		lastConnectedAt: now,
		lastValidatedAt: now,
		lastErrorMessage: null,
		errorCount: 0,
		updatedAt: now,
	};

	if (existing) {
		await db
			.update(waAccounts)
			.set(values)
			.where(eq(waAccounts.id, existing.id));
		return;
	}

	await db.insert(waAccounts).values({
		organizationId,
		...values,
	});
}
