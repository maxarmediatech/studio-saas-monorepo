import { and, eq, sql } from "@repo/database";
import { waContacts, waMessages, waOutbox } from "@repo/whatsapp-db";
import type { WhatsAppTransaction } from "./types";

async function lockIdentity(tx: WhatsAppTransaction, identity: string) {
	await tx.execute(
		sql`SELECT pg_advisory_xact_lock(hashtextextended(${identity}, 0))`,
	);
}

export async function ensureWhatsAppContactIdentity(
	tx: WhatsAppTransaction,
	params: {
		organizationId: string;
		accountId: string;
		waId: string;
		contactName?: string | null;
	},
) {
	await lockIdentity(
		tx,
		`whatsapp:contact:${params.accountId}:${params.waId}`,
	);
	const existing = await tx
		.select({
			id: waContacts.id,
			organizationId: waContacts.organizationId,
			name: waContacts.name,
		})
		.from(waContacts)
		.where(
			and(
				eq(waContacts.accountId, params.accountId),
				eq(waContacts.waId, params.waId),
			),
		)
		.orderBy(waContacts.createdAt, waContacts.id)
		.limit(2);
	if (existing.length > 1) {
		throw new Error(
			"WhatsApp contact identity is ambiguous and requires reconciliation",
		);
	}
	const contact = existing[0];
	if (contact) {
		if (contact.organizationId !== params.organizationId) {
			throw new Error(
				"WhatsApp contact identity belongs to another organization and requires reconciliation",
			);
		}
		if (contact.name == null && params.contactName != null) {
			await tx
				.update(waContacts)
				.set({ name: params.contactName, updatedAt: new Date() })
				.where(eq(waContacts.id, contact.id));
		}
		return contact.id;
	}

	const [created] = await tx
		.insert(waContacts)
		.values({
			organizationId: params.organizationId,
			accountId: params.accountId,
			waId: params.waId,
			phoneNumber: params.waId,
			name: params.contactName ?? null,
		})
		.returning({ id: waContacts.id });
	if (!created) {
		throw new Error("Failed to create WhatsApp contact");
	}
	return created.id;
}

export async function findWhatsAppProviderMessageIdentity(
	tx: WhatsAppTransaction,
	params: { accountId: string; providerMessageId: string },
) {
	await lockIdentity(
		tx,
		`whatsapp:provider-message:${params.accountId}:${params.providerMessageId}`,
	);
	const existing = await tx
		.select({ id: waMessages.id })
		.from(waMessages)
		.where(
			and(
				eq(waMessages.accountId, params.accountId),
				eq(waMessages.providerMessageId, params.providerMessageId),
			),
		)
		.orderBy(waMessages.createdAt, waMessages.id)
		.limit(2);
	if (existing.length > 1) {
		throw new Error(
			"WhatsApp provider message identity is ambiguous and requires reconciliation",
		);
	}
	return existing[0]?.id ?? null;
}

export async function ensureWhatsAppOutboxEffect(
	tx: WhatsAppTransaction,
	params: { organizationId: string; accountId: string; messageId: string },
) {
	await lockIdentity(tx, `whatsapp:outbox-message:${params.messageId}`);
	const existing = await tx
		.select({
			id: waOutbox.id,
			organizationId: waOutbox.organizationId,
			accountId: waOutbox.accountId,
		})
		.from(waOutbox)
		.where(eq(waOutbox.messageId, params.messageId))
		.orderBy(waOutbox.createdAt, waOutbox.id)
		.limit(2);
	if (existing.length > 1) {
		throw new Error(
			"WhatsApp outbox message identity is ambiguous and requires reconciliation",
		);
	}
	const effect = existing[0];
	if (effect) {
		if (
			effect.organizationId !== params.organizationId ||
			effect.accountId !== params.accountId
		) {
			throw new Error(
				"WhatsApp outbox message identity has conflicting ownership and requires reconciliation",
			);
		}
		return effect.id;
	}
	const [created] = await tx
		.insert(waOutbox)
		.values(params)
		.returning({ id: waOutbox.id });
	if (!created) {
		throw new Error("Failed to create WhatsApp outbox effect");
	}
	return created.id;
}
