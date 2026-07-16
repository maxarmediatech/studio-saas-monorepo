import { and, db, eq } from "@repo/database";
import {
	waAccounts,
	waContacts,
	waConversations,
	waEvents,
	waMedia,
	waMessages,
	waOutbox,
} from "@repo/whatsapp-db";
import { processDueWhatsAppEvents } from "@repo/whatsapp-runtime";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { handleCloudWebhook } from "./webhook-handler";

const ORGANIZATION_ID = "whatsapp-webhook-pg-test";
const TOKEN = "whatsapp-webhook-pg-token";

const cleanup = async () => {
	await db
		.delete(waOutbox)
		.where(eq(waOutbox.organizationId, ORGANIZATION_ID));
	await db
		.delete(waEvents)
		.where(eq(waEvents.organizationId, ORGANIZATION_ID));
	await db
		.delete(waMessages)
		.where(eq(waMessages.organizationId, ORGANIZATION_ID));
	await db.delete(waMedia).where(eq(waMedia.organizationId, ORGANIZATION_ID));
	await db
		.delete(waConversations)
		.where(eq(waConversations.organizationId, ORGANIZATION_ID));
	await db
		.delete(waContacts)
		.where(eq(waContacts.organizationId, ORGANIZATION_ID));
	await db
		.delete(waAccounts)
		.where(eq(waAccounts.organizationId, ORGANIZATION_ID));
};

const createAccount = async (suffix: string) => {
	const [account] = await db
		.insert(waAccounts)
		.values({
			organizationId: ORGANIZATION_ID,
			name: `Webhook test ${suffix}`,
			provider: "cloud_api",
			connectionStatus: "connected",
			phoneNumberId: `phone-${suffix}`,
			webhookVerifyToken: TOKEN,
		})
		.returning();
	if (!account?.phoneNumberId) {
		throw new Error("Failed to create webhook test account");
	}
	return { ...account, phoneNumberId: account.phoneNumberId };
};

const inboundPayload = (params: {
	phoneNumberId: string;
	messageId: string;
	from?: string;
}) => ({
	entry: [
		{
			changes: [
				{
					value: {
						metadata: { phone_number_id: params.phoneNumberId },
						messages: [
							{
								id: params.messageId,
								from: params.from ?? "919999999999",
								timestamp: "1770000000",
								type: "text",
								text: { body: "hello" },
							},
						],
					},
				},
			],
		},
	],
});

const statusPayload = (params: {
	phoneNumberId: string;
	messageId: string;
}) => ({
	entry: [
		{
			changes: [
				{
					value: {
						metadata: { phone_number_id: params.phoneNumberId },
						statuses: [
							{
								id: params.messageId,
								status: "delivered",
								timestamp: "1770000001",
							},
						],
					},
				},
			],
		},
	],
});

const postWebhook = (payload: unknown) =>
	handleCloudWebhook(
		new Request("http://localhost/webhook", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify(payload),
		}),
		TOKEN,
	);

describe("WhatsApp webhook PostgreSQL invariants", () => {
	beforeAll(cleanup);
	afterAll(cleanup);

	it("serializes duplicate inbound deliveries into one contact, conversation, and message", async () => {
		const account = await createAccount("concurrent");
		const payload = inboundPayload({
			phoneNumberId: account.phoneNumberId,
			messageId: "provider-inbound-concurrent",
		});

		const responses = await Promise.all(
			Array.from({ length: 8 }, () => postWebhook(payload)),
		);
		expect(responses.every((response) => response.status === 200)).toBe(
			true,
		);

		const contacts = await db
			.select()
			.from(waContacts)
			.where(eq(waContacts.accountId, account.id));
		const conversations = await db
			.select()
			.from(waConversations)
			.where(eq(waConversations.accountId, account.id));
		const messages = await db
			.select()
			.from(waMessages)
			.where(eq(waMessages.accountId, account.id));
		const events = await db
			.select()
			.from(waEvents)
			.where(eq(waEvents.accountId, account.id));

		expect(contacts).toHaveLength(1);
		expect(conversations).toHaveLength(1);
		expect(messages).toHaveLength(1);
		expect(events).toHaveLength(1);
		expect(events[0].processedAt).not.toBeNull();
		expect(events[0].errorMessage).toBeNull();
		expect(conversations[0].unreadCount).toBe(1);
	});

	it("creates one contact and conversation when distinct inbound events race", async () => {
		const account = await createAccount("conversation-race");
		const responses = await Promise.all(
			Array.from({ length: 8 }, (_, index) =>
				postWebhook(
					inboundPayload({
						phoneNumberId: account.phoneNumberId,
						messageId: `provider-conversation-race-${index}`,
						from: "933333333333",
					}),
				),
			),
		);
		expect(responses.every((response) => response.status === 200)).toBe(
			true,
		);

		const contacts = await db
			.select()
			.from(waContacts)
			.where(eq(waContacts.accountId, account.id));
		const conversations = await db
			.select()
			.from(waConversations)
			.where(eq(waConversations.accountId, account.id));
		const messages = await db
			.select()
			.from(waMessages)
			.where(eq(waMessages.accountId, account.id));

		expect(contacts).toHaveLength(1);
		expect(conversations).toHaveLength(1);
		expect(messages).toHaveLength(8);
		expect(conversations[0].unreadCount).toBe(8);
	});

	it("scopes the same WhatsApp identity independently to each account", async () => {
		const [first, second] = await Promise.all([
			createAccount("identity-a"),
			createAccount("identity-b"),
		]);
		await Promise.all([
			postWebhook(
				inboundPayload({
					phoneNumberId: first.phoneNumberId,
					messageId: "provider-identity-a",
					from: "911111111111",
				}),
			),
			postWebhook(
				inboundPayload({
					phoneNumberId: second.phoneNumberId,
					messageId: "provider-identity-b",
					from: "911111111111",
				}),
			),
		]);

		const contacts = await db
			.select()
			.from(waContacts)
			.where(
				and(
					eq(waContacts.organizationId, ORGANIZATION_ID),
					eq(waContacts.waId, "911111111111"),
				),
			);
		expect(contacts).toHaveLength(2);
		expect(new Set(contacts.map((contact) => contact.accountId)).size).toBe(
			2,
		);
	});

	it("replays a stored failed status event without provider redelivery", async () => {
		const account = await createAccount("retry");
		const payload = statusPayload({
			phoneNumberId: account.phoneNumberId,
			messageId: "provider-status-retry",
		});

		await postWebhook(payload);
		const [failedEvent] = await db
			.select()
			.from(waEvents)
			.where(eq(waEvents.accountId, account.id));
		expect(failedEvent.processedAt).toBeNull();
		expect(failedEvent.errorMessage).toContain("Message not found");
		expect(failedEvent.processingStatus).toBe("failed");

		const [contact] = await db
			.insert(waContacts)
			.values({
				organizationId: ORGANIZATION_ID,
				accountId: account.id,
				waId: "922222222222",
				phoneNumber: "922222222222",
			})
			.returning();
		const [conversation] = await db
			.insert(waConversations)
			.values({
				organizationId: ORGANIZATION_ID,
				accountId: account.id,
				contactId: contact.id,
			})
			.returning();
		const [message] = await db
			.insert(waMessages)
			.values({
				organizationId: ORGANIZATION_ID,
				accountId: account.id,
				conversationId: conversation.id,
				contactId: contact.id,
				providerMessageId: "provider-status-retry",
				direction: "outbound",
				type: "text",
				textBody: "outbound",
				status: "sent",
			})
			.returning();

		await Promise.all([
			processDueWhatsAppEvents({
				workerId: "webhook-replay-a",
				now: new Date("2030-01-01T00:00:00.000Z"),
			}),
			processDueWhatsAppEvents({
				workerId: "webhook-replay-b",
				now: new Date("2030-01-01T00:00:00.000Z"),
			}),
		]);
		const [processedEvent] = await db
			.select()
			.from(waEvents)
			.where(eq(waEvents.id, failedEvent.id));
		const [updatedMessage] = await db
			.select()
			.from(waMessages)
			.where(eq(waMessages.id, message.id));
		expect(processedEvent.processedAt).not.toBeNull();
		expect(processedEvent.errorMessage).toBeNull();
		expect(processedEvent.processingStatus).toBe("processed");
		expect(processedEvent.attempts).toBe(2);
		expect(updatedMessage.status).toBe("delivered");
	});
});
