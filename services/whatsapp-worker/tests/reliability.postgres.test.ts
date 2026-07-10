import { and, db, eq } from "@repo/database";
import type { WhatsAppProvider } from "@repo/whatsapp-core";
import {
	waAccounts,
	waContacts,
	waConversations,
	waMedia,
	waMessages,
	waOutbox,
} from "@repo/whatsapp-db";
import {
	fetchDueWhatsAppOutboxItems,
	processWhatsAppOutboxItem,
	recoverExpiredWhatsAppOutboxLeases,
} from "@repo/whatsapp-outbox";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
	fetchDueInboundMedia,
	processInboundMediaItem,
	recoverExpiredWhatsAppMediaLeases,
} from "../src/media-worker";

const ORGANIZATION_ID = "whatsapp-worker-pg-test";

const cleanup = async () => {
	await db
		.delete(waOutbox)
		.where(eq(waOutbox.organizationId, ORGANIZATION_ID));
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

const createFixture = async (suffix: string, withMedia = false) => {
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
	const media = withMedia
		? (
				await db
					.insert(waMedia)
					.values({
						organizationId: ORGANIZATION_ID,
						providerMediaId: `provider-media-${suffix}`,
						mimeType: "image/jpeg",
						storageType: "s3",
						storageUrl: null,
						ingestStatus: "pending",
						nextIngestAttemptAt: new Date(),
					})
					.returning()
			)[0]
		: null;
	const [message] = await db
		.insert(waMessages)
		.values({
			organizationId: ORGANIZATION_ID,
			accountId: account.id,
			conversationId: conversation.id,
			contactId: contact.id,
			mediaId: media?.id ?? null,
			direction: withMedia ? "inbound" : "outbound",
			type: withMedia ? "image" : "text",
			textBody: withMedia ? null : "send me",
			status: withMedia ? "delivered" : "queued",
		})
		.returning();
	const outbox = withMedia
		? null
		: (
				await db
					.insert(waOutbox)
					.values({
						organizationId: ORGANIZATION_ID,
						accountId: account.id,
						messageId: message.id,
						status: "pending",
					})
					.returning()
			)[0];
	return { account, contact, conversation, media, message, outbox };
};

const requireOutbox = (fixture: Awaited<ReturnType<typeof createFixture>>) => {
	if (!fixture.outbox) {
		throw new Error("Expected an outbox fixture");
	}
	return fixture.outbox;
};

const requireMedia = (fixture: Awaited<ReturnType<typeof createFixture>>) => {
	if (!fixture.media) {
		throw new Error("Expected a media fixture");
	}
	return fixture.media;
};

const provider = (
	sendText: () => Promise<{ success: boolean; providerMessageId?: string }>,
) =>
	({
		type: "cloud_api",
		capabilities: new Set(),
		provisioning: {
			startLink: async () => ({ status: "connected" as const }),
			getStatus: async () => "connected" as const,
			disconnect: async () => undefined,
		},
		messaging: {
			sendText: async () => sendText(),
			sendMedia: async () => ({ success: true }),
			markRead: async () => undefined,
			supports: () => true,
		},
		destroy: async () => undefined,
	}) satisfies WhatsAppProvider;

describe("WhatsApp worker PostgreSQL reliability", () => {
	beforeAll(cleanup);
	afterAll(cleanup);

	it("allows only one worker to claim and dispatch an outbox row", async () => {
		const fixture = await createFixture("concurrent-outbox");
		const fixtureOutbox = requireOutbox(fixture);
		const [item] = await fetchDueWhatsAppOutboxItems({ limit: 1 });
		let sends = 0;
		const factory = () =>
			provider(async () => {
				sends++;
				await new Promise((resolve) => setTimeout(resolve, 40));
				return {
					success: true,
					providerMessageId: "provider-sent-once",
				};
			});

		const results = await Promise.all([
			processWhatsAppOutboxItem(item, {
				workerId: "outbox-worker-a",
				providerFactory: factory,
			}),
			processWhatsAppOutboxItem(item, {
				workerId: "outbox-worker-b",
				providerFactory: factory,
			}),
		]);
		expect(sends).toBe(1);
		expect(results.map((result) => result.status).sort()).toEqual([
			"sent",
			"skipped",
		]);
		const [outbox] = await db
			.select()
			.from(waOutbox)
			.where(eq(waOutbox.id, fixtureOutbox.id));
		expect(outbox.status).toBe("sent");
	});

	it("suppresses a newly opted-out contact without calling the provider", async () => {
		const fixture = await createFixture("suppressed");
		const fixtureOutbox = requireOutbox(fixture);
		const due = await fetchDueWhatsAppOutboxItems({ limit: 100 });
		const item = due.find((row) => row.outbox.id === fixtureOutbox.id);
		if (!item) {
			throw new Error("Expected suppression fixture to be due");
		}
		await db
			.update(waContacts)
			.set({ isOptedOut: true })
			.where(eq(waContacts.id, fixture.contact.id));
		let sends = 0;
		const result = await processWhatsAppOutboxItem(item, {
			workerId: "suppression-worker",
			providerFactory: () =>
				provider(async () => {
					sends += 1;
					return {
						success: true,
						providerMessageId: "must-not-send",
					};
				}),
		});
		expect(result.status).toBe("suppressed");
		expect(sends).toBe(0);
		const [storedMessage] = await db
			.select()
			.from(waMessages)
			.where(eq(waMessages.id, fixture.message.id));
		const [storedOutbox] = await db
			.select()
			.from(waOutbox)
			.where(eq(waOutbox.id, fixtureOutbox.id));
		expect(storedMessage.status).toBe("suppressed");
		expect(storedOutbox.status).toBe("suppressed");
		expect(storedOutbox.nextAttemptAt).toBeNull();
	});

	it("recovers expired pre-dispatch leases but quarantines post-dispatch leases", async () => {
		const safe = await createFixture("safe-lease");
		const unknown = await createFixture("unknown-lease");
		const safeOutbox = requireOutbox(safe);
		const unknownOutbox = requireOutbox(unknown);
		const expired = new Date(Date.now() - 60_000);
		await db
			.update(waOutbox)
			.set({
				status: "processing",
				lockedBy: "dead-worker",
				leaseExpiresAt: expired,
				dispatchStartedAt: null,
			})
			.where(eq(waOutbox.id, safeOutbox.id));
		await db
			.update(waOutbox)
			.set({
				status: "processing",
				lockedBy: "dead-worker",
				leaseExpiresAt: expired,
				dispatchStartedAt: expired,
			})
			.where(eq(waOutbox.id, unknownOutbox.id));

		const result = await recoverExpiredWhatsAppOutboxLeases();
		expect(result).toEqual({ recovered: 1, unknown: 1 });
		const rows = await db
			.select()
			.from(waOutbox)
			.where(
				and(
					eq(waOutbox.organizationId, ORGANIZATION_ID),
					eq(waOutbox.status, "delivery_unknown"),
				),
			);
		expect(rows.map((row) => row.id)).toContain(unknownOutbox.id);
		const due = await fetchDueWhatsAppOutboxItems({ limit: 100 });
		expect(due.map((item) => item.outbox.id)).toContain(safeOutbox.id);
		expect(due.map((item) => item.outbox.id)).not.toContain(
			unknownOutbox.id,
		);
	});

	it("does not retry when a provider call has an ambiguous outcome", async () => {
		const fixture = await createFixture("ambiguous-send");
		const fixtureOutbox = requireOutbox(fixture);
		const due = await fetchDueWhatsAppOutboxItems({ limit: 100 });
		const item = due.find((row) => row.outbox.id === fixtureOutbox.id);
		if (!item) {
			throw new Error("Expected ambiguous outbox item to be due");
		}
		const result = await processWhatsAppOutboxItem(item, {
			workerId: "ambiguous-worker",
			providerFactory: () =>
				provider(async () => {
					throw new Error(
						"connection closed after request body was sent",
					);
				}),
		});
		expect(result.status).toBe("delivery_unknown");

		const [row] = await db
			.select()
			.from(waOutbox)
			.where(eq(waOutbox.id, fixtureOutbox.id));
		expect(row.status).toBe("delivery_unknown");
		expect(row.nextAttemptAt).toBeNull();
		const nextDue = await fetchDueWhatsAppOutboxItems({ limit: 100 });
		expect(nextDue.map((candidate) => candidate.outbox.id)).not.toContain(
			row.id,
		);
	});

	it("recovers an expired media lease and preserves single-claim ingestion", async () => {
		const fixture = await createFixture("media-lease", true);
		const fixtureMedia = requireMedia(fixture);
		const expired = new Date(Date.now() - 60_000);
		await db
			.update(waMedia)
			.set({
				ingestStatus: "processing",
				ingestLockedBy: "dead-media-worker",
				ingestLeaseExpiresAt: expired,
			})
			.where(eq(waMedia.id, fixtureMedia.id));
		expect(await recoverExpiredWhatsAppMediaLeases()).toBe(1);

		const due = await fetchDueInboundMedia({ limit: 100 });
		const item = due.find((row) => row.media.id === fixtureMedia.id);
		if (!item) {
			throw new Error("Expected recovered media item to be due");
		}
		let ingests = 0;
		const ingest = async () => {
			ingests++;
			await new Promise((resolve) => setTimeout(resolve, 40));
			return {
				fileName: "photo.jpg",
				fileSize: 12,
				mimeType: "image/jpeg",
				storageUrl: "orgs/test/media.jpg",
			};
		};
		const results = await Promise.all([
			processInboundMediaItem(item, {
				workerId: "media-worker-a",
				ingest,
			}),
			processInboundMediaItem(item, {
				workerId: "media-worker-b",
				ingest,
			}),
		]);
		expect(ingests).toBe(1);
		expect(results.map((result) => result.status).sort()).toEqual([
			"ready",
			"skipped",
		]);
		const [media] = await db
			.select()
			.from(waMedia)
			.where(eq(waMedia.id, fixtureMedia.id));
		expect(media.ingestStatus).toBe("ready");
		expect(media.storageUrl).toBe("orgs/test/media.jpg");
	});
});
