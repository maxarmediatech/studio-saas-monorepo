import { db, eq } from "@repo/database";
import {
	waAccounts,
	waAutomationActions,
	waAutomationRuns,
	waBotFlows,
	waCampaignRecipients,
	waCampaigns,
	waContacts,
	waConversations,
	waMessages,
	waOutbox,
} from "@repo/whatsapp-db";
import {
	enqueueInboundAutomationRuns,
	enqueueWhatsAppCampaign,
	processAutomationRun,
	recoverExpiredAutomationLeases,
	transitionWhatsAppMessage,
} from "@repo/whatsapp-runtime";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const ORGANIZATION_ID = "whatsapp-product-state-pg-test";

const cleanup = async () => {
	await db
		.delete(waAutomationActions)
		.where(eq(waAutomationActions.organizationId, ORGANIZATION_ID));
	await db
		.delete(waAutomationRuns)
		.where(eq(waAutomationRuns.organizationId, ORGANIZATION_ID));
	await db
		.delete(waCampaignRecipients)
		.where(eq(waCampaignRecipients.organizationId, ORGANIZATION_ID));
	await db
		.delete(waOutbox)
		.where(eq(waOutbox.organizationId, ORGANIZATION_ID));
	await db
		.delete(waMessages)
		.where(eq(waMessages.organizationId, ORGANIZATION_ID));
	await db
		.delete(waCampaigns)
		.where(eq(waCampaigns.organizationId, ORGANIZATION_ID));
	await db
		.delete(waBotFlows)
		.where(eq(waBotFlows.organizationId, ORGANIZATION_ID));
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

const createConversation = async (suffix: string) => {
	const [account] = await db
		.insert(waAccounts)
		.values({
			organizationId: ORGANIZATION_ID,
			name: suffix,
			provider: "cloud_api",
			connectionStatus: "connected",
			phoneNumberId: `phone-${suffix}`,
			accessToken: "test-token",
		})
		.returning();
	const [contact] = await db
		.insert(waContacts)
		.values({
			organizationId: ORGANIZATION_ID,
			accountId: account.id,
			waId: `91${suffix}`,
			phoneNumber: `91${suffix}`,
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
	return { account, contact, conversation };
};

describe("WhatsApp product state PostgreSQL invariants", () => {
	beforeAll(cleanup);
	afterAll(cleanup);

	it("materializes and enqueues one durable effect per campaign recipient", async () => {
		const first = await createConversation("campaign-a");
		const [secondContact] = await db
			.insert(waContacts)
			.values({
				organizationId: ORGANIZATION_ID,
				accountId: first.account.id,
				waId: "91campaign-b",
				phoneNumber: "91campaign-b",
			})
			.returning();
		await db.insert(waConversations).values({
			organizationId: ORGANIZATION_ID,
			accountId: first.account.id,
			contactId: secondContact.id,
		});
		const [campaign] = await db
			.insert(waCampaigns)
			.values({
				organizationId: ORGANIZATION_ID,
				accountId: first.account.id,
				name: "Concurrent campaign",
				messageType: "text",
				textBody: "hello",
				audienceFilter: { linkType: "all" },
			})
			.returning();

		await Promise.all([
			enqueueWhatsAppCampaign(campaign.id),
			enqueueWhatsAppCampaign(campaign.id),
		]);
		await db.insert(waContacts).values({
			organizationId: ORGANIZATION_ID,
			accountId: first.account.id,
			waId: "91campaign-late",
			phoneNumber: "91campaign-late",
		});
		await enqueueWhatsAppCampaign(campaign.id);
		const recipients = await db
			.select()
			.from(waCampaignRecipients)
			.where(eq(waCampaignRecipients.campaignId, campaign.id));
		const messages = await db
			.select()
			.from(waMessages)
			.where(eq(waMessages.sentByCampaignId, campaign.id));
		const outbox = await db
			.select()
			.from(waOutbox)
			.where(eq(waOutbox.organizationId, ORGANIZATION_ID));
		expect(recipients).toHaveLength(2);
		expect(new Set(recipients.map((row) => row.contactId)).size).toBe(2);
		expect(messages).toHaveLength(2);
		expect(outbox).toHaveLength(2);
		expect(recipients.every((row) => row.status === "queued")).toBe(true);

		const [firstMessage, secondMessage] = messages;
		const unknownAt = new Date("2026-07-10T10:00:00.000Z");
		await db.transaction((tx) =>
			transitionWhatsAppMessage(tx, {
				messageId: firstMessage.id,
				status: "delivery_unknown",
				at: unknownAt,
			}),
		);
		await db.transaction((tx) =>
			transitionWhatsAppMessage(tx, {
				messageId: firstMessage.id,
				status: "delivered",
				at: new Date("2026-07-10T10:02:00.000Z"),
			}),
		);
		await db.transaction((tx) =>
			transitionWhatsAppMessage(tx, {
				messageId: firstMessage.id,
				status: "sent",
				at: new Date("2026-07-10T10:01:00.000Z"),
			}),
		);
		await db.transaction((tx) =>
			transitionWhatsAppMessage(tx, {
				messageId: firstMessage.id,
				status: "read",
				at: new Date("2026-07-10T10:03:00.000Z"),
			}),
		);
		await db.transaction((tx) =>
			transitionWhatsAppMessage(tx, {
				messageId: secondMessage.id,
				status: "failed",
				errorMessage: "provider rejected recipient",
			}),
		);

		const [updatedCampaign] = await db
			.select()
			.from(waCampaigns)
			.where(eq(waCampaigns.id, campaign.id));
		const [updatedMessage] = await db
			.select()
			.from(waMessages)
			.where(eq(waMessages.id, firstMessage.id));
		expect(updatedMessage.status).toBe("read");
		expect(updatedCampaign).toMatchObject({
			totalRecipients: 2,
			totalQueued: 2,
			totalSent: 1,
			totalDelivered: 1,
			totalRead: 1,
			totalFailed: 1,
			totalDeliveryUnknown: 0,
		});
	});

	it("deduplicates automation triggers and resumes a persisted wait", async () => {
		const fixture = await createConversation("automation-wait");
		const [inbound] = await db
			.insert(waMessages)
			.values({
				organizationId: ORGANIZATION_ID,
				accountId: fixture.account.id,
				conversationId: fixture.conversation.id,
				contactId: fixture.contact.id,
				direction: "inbound",
				type: "text",
				textBody: "start now",
				status: "delivered",
			})
			.returning();
		const [flow] = await db
			.insert(waBotFlows)
			.values({
				organizationId: ORGANIZATION_ID,
				accountId: fixture.account.id,
				name: "Durable flow",
				status: "published",
				triggerType: "keyword",
				triggerKeywords: ["start"],
				publishedVersion: 1,
				flowData: {
					actions: [
						{ type: "send_text", text: "welcome" },
						{ type: "wait", durationMinutes: 1 },
						{ type: "add_tag", tag: "nurtured" },
					],
				},
			})
			.returning();
		const enqueue = () =>
			db.transaction((tx) =>
				enqueueInboundAutomationRuns(tx, {
					organizationId: ORGANIZATION_ID,
					accountId: fixture.account.id,
					contactId: fixture.contact.id,
					conversationId: fixture.conversation.id,
					inboundMessageId: inbound.id,
					inboundText: "start now",
					triggerIdentity: "provider-trigger-1",
				}),
			);
		await Promise.all([enqueue(), enqueue(), enqueue()]);
		const [run] = await db
			.select()
			.from(waAutomationRuns)
			.where(eq(waAutomationRuns.flowId, flow.id));
		const actions = await db
			.select()
			.from(waAutomationActions)
			.where(eq(waAutomationActions.runId, run.id));
		expect(actions).toHaveLength(3);
		expect(
			(
				await db
					.select()
					.from(waAutomationRuns)
					.where(eq(waAutomationRuns.flowId, flow.id))
			).length,
		).toBe(1);

		const start = new Date("2026-07-10T12:00:00.000Z");
		await Promise.all([
			processAutomationRun(run.id, {
				workerId: "automation-a",
				now: start,
			}),
			processAutomationRun(run.id, {
				workerId: "automation-b",
				now: start,
			}),
		]);
		expect(
			await db
				.select()
				.from(waMessages)
				.where(eq(waMessages.sentByBotFlowId, flow.id)),
		).toHaveLength(1);
		await processAutomationRun(run.id, {
			workerId: "automation-a",
			now: new Date(start.getTime() + 1000),
		});
		const [waiting] = await db
			.select()
			.from(waAutomationRuns)
			.where(eq(waAutomationRuns.id, run.id));
		expect(waiting.status).toBe("waiting");
		await processAutomationRun(run.id, {
			workerId: "automation-a",
			now: new Date(start.getTime() + 30_000),
		});
		const due = new Date(start.getTime() + 61_000);
		await processAutomationRun(run.id, {
			workerId: "automation-a",
			now: due,
		});
		await processAutomationRun(run.id, {
			workerId: "automation-a",
			now: new Date(due.getTime() + 1000),
		});
		const [completed] = await db
			.select()
			.from(waAutomationRuns)
			.where(eq(waAutomationRuns.id, run.id));
		const [tagged] = await db
			.select()
			.from(waContacts)
			.where(eq(waContacts.id, fixture.contact.id));
		expect(completed.lastError).toBeNull();
		expect(completed.status).toBe("completed");
		expect(tagged.tags).toContain("nurtured");
	});

	it("recovers a crashed action without duplicating its message effect", async () => {
		const fixture = await createConversation("automation-crash");
		const [inbound] = await db
			.insert(waMessages)
			.values({
				organizationId: ORGANIZATION_ID,
				accountId: fixture.account.id,
				conversationId: fixture.conversation.id,
				contactId: fixture.contact.id,
				direction: "inbound",
				type: "text",
				textBody: "recover",
				status: "delivered",
			})
			.returning();
		const [flow] = await db
			.insert(waBotFlows)
			.values({
				organizationId: ORGANIZATION_ID,
				accountId: fixture.account.id,
				name: "Crash flow",
				status: "published",
				triggerType: "keyword",
				triggerKeywords: ["recover"],
				flowData: { actions: [{ type: "send_text", text: "once" }] },
			})
			.returning();
		await db.transaction((tx) =>
			enqueueInboundAutomationRuns(tx, {
				organizationId: ORGANIZATION_ID,
				accountId: fixture.account.id,
				contactId: fixture.contact.id,
				conversationId: fixture.conversation.id,
				inboundMessageId: inbound.id,
				inboundText: "recover",
			}),
		);
		const [run] = await db
			.select()
			.from(waAutomationRuns)
			.where(eq(waAutomationRuns.flowId, flow.id));
		const [action] = await db
			.select()
			.from(waAutomationActions)
			.where(eq(waAutomationActions.runId, run.id));
		const [existingMessage] = await db
			.insert(waMessages)
			.values({
				organizationId: ORGANIZATION_ID,
				accountId: fixture.account.id,
				conversationId: fixture.conversation.id,
				contactId: fixture.contact.id,
				direction: "outbound",
				type: "text",
				textBody: "once",
				status: "queued",
				sentByBotFlowId: flow.id,
				automationActionId: action.id,
			})
			.returning();
		await db.insert(waOutbox).values({
			organizationId: ORGANIZATION_ID,
			accountId: fixture.account.id,
			messageId: existingMessage.id,
		});
		const expired = new Date("2026-07-10T12:59:00.000Z");
		await db
			.update(waAutomationRuns)
			.set({
				status: "processing",
				lockedBy: "dead",
				leaseExpiresAt: expired,
			})
			.where(eq(waAutomationRuns.id, run.id));
		await db
			.update(waAutomationActions)
			.set({
				status: "processing",
				lockedBy: "dead",
				leaseExpiresAt: expired,
			})
			.where(eq(waAutomationActions.id, action.id));
		const now = new Date("2026-07-10T13:00:00.000Z");
		await recoverExpiredAutomationLeases(now);
		await processAutomationRun(run.id, {
			workerId: "recovery-worker",
			now,
		});
		expect(
			await db
				.select()
				.from(waMessages)
				.where(eq(waMessages.automationActionId, action.id)),
		).toHaveLength(1);
		expect(
			await db
				.select()
				.from(waOutbox)
				.where(eq(waOutbox.messageId, existingMessage.id)),
		).toHaveLength(1);
		const [completed] = await db
			.select()
			.from(waAutomationRuns)
			.where(eq(waAutomationRuns.id, run.id));
		expect(completed.status).toBe("completed");
	});
});
