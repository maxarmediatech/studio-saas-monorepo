import { and, db, eq } from "@repo/database";
import type { WhatsAppProvider } from "@repo/whatsapp-core";
import {
	waAccounts,
	waContacts,
	waConversations,
	waEvents,
	waMedia,
	waMessages,
	waOutbox,
} from "@repo/whatsapp-db";
import {
	fetchDueWhatsAppOutboxItems,
	processWhatsAppOutboxItem,
	recordWhatsAppProviderAcceptance,
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
		.delete(waEvents)
		.where(eq(waEvents.organizationId, ORGANIZATION_ID));
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
				attempts: 3,
				maxAttempts: 3,
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
		const repeated = await recoverExpiredWhatsAppOutboxLeases();
		expect(repeated).toEqual({ recovered: 0, unknown: 0 });
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
		expect(
			due.find((item) => item.outbox.id === safeOutbox.id)?.outbox
				.attempts,
		).toBe(2);
		expect(due.map((item) => item.outbox.id)).not.toContain(
			unknownOutbox.id,
		);
	});

	it("reconciles late provider acceptance with stored status events", async () => {
		const fixture = await createFixture("late-acceptance");
		const fixtureOutbox = requireOutbox(fixture);
		const due = await fetchDueWhatsAppOutboxItems({ limit: 100 });
		const item = due.find((row) => row.outbox.id === fixtureOutbox.id);
		if (!item) {
			throw new Error("Expected late-acceptance fixture to be due");
		}

		let releaseProvider!: () => void;
		let observeDispatch!: () => void;
		const providerReleased = new Promise<void>((resolve) => {
			releaseProvider = resolve;
		});
		const dispatchObserved = new Promise<void>((resolve) => {
			observeDispatch = resolve;
		});
		const processing = processWhatsAppOutboxItem(item, {
			workerId: "late-worker",
			providerFactory: () =>
				provider(async () => {
					observeDispatch();
					await providerReleased;
					return {
						success: true,
						providerMessageId: "provider-late-accepted",
					};
				}),
		});
		await dispatchObserved;

		const [dispatched] = await db
			.select()
			.from(waOutbox)
			.where(eq(waOutbox.id, fixtureOutbox.id));
		expect(dispatched.dispatchToken).toBeTruthy();
		await db.insert(waEvents).values({
			organizationId: ORGANIZATION_ID,
			accountId: fixture.account.id,
			providerEventId: "provider-late-accepted:delivered:1",
			eventType: "message.status",
			payload: {
				event: {
					type: "message.status",
					phoneNumberId: fixture.account.phoneNumberId,
					providerMessageId: "provider-late-accepted",
					status: "delivered",
					timestamp: new Date("2026-07-15T08:00:00.000Z"),
				},
				rawPayload: {},
			},
			processingStatus: "failed",
			attempts: 10,
			maxAttempts: 10,
			errorMessage: "Message not found for WhatsApp status update",
			nextAttemptAt: new Date("2026-07-15T08:00:00.000Z"),
		});
		await db
			.update(waOutbox)
			.set({ leaseExpiresAt: new Date("2026-07-15T07:59:00.000Z") })
			.where(eq(waOutbox.id, fixtureOutbox.id));
		expect(
			await recoverExpiredWhatsAppOutboxLeases(
				new Date("2026-07-15T08:00:00.000Z"),
			),
		).toEqual({ recovered: 0, unknown: 1 });

		releaseProvider();
		expect(await processing).toEqual({ status: "sent" });

		const repeated = await recordWhatsAppProviderAcceptance({
			outboxId: fixtureOutbox.id,
			messageId: fixture.message.id,
			workerId: "late-worker",
			dispatchToken: dispatched.dispatchToken ?? "",
			providerMessageId: "provider-late-accepted",
		});
		expect(repeated.status).toBe("already_accepted");
		const [storedOutbox] = await db
			.select()
			.from(waOutbox)
			.where(eq(waOutbox.id, fixtureOutbox.id));
		const [storedMessage] = await db
			.select()
			.from(waMessages)
			.where(eq(waMessages.id, fixture.message.id));
		const [storedEvent] = await db
			.select()
			.from(waEvents)
			.where(eq(waEvents.accountId, fixture.account.id));
		expect(storedOutbox.status).toBe("sent");
		expect(storedOutbox.dispatchToken).toBe(dispatched.dispatchToken);
		expect(storedMessage.providerMessageId).toBe("provider-late-accepted");
		expect(storedMessage.status).toBe("delivered");
		expect(storedEvent.processingStatus).toBe("processed");
		expect(storedEvent.processedAt).not.toBeNull();
		expect(storedEvent.attempts).toBe(10);
	});

	it("quarantines conflicting provider identity evidence without resend", async () => {
		const fixture = await createFixture("identity-conflict");
		const fixtureOutbox = requireOutbox(fixture);
		await db
			.update(waMessages)
			.set({
				status: "delivery_unknown",
				providerMessageId: "provider-original",
			})
			.where(eq(waMessages.id, fixture.message.id));
		await db
			.update(waOutbox)
			.set({
				status: "delivery_unknown",
				dispatchStartedAt: new Date(),
				dispatchToken: "dispatch-conflict",
				nextAttemptAt: null,
			})
			.where(eq(waOutbox.id, fixtureOutbox.id));

		await expect(
			recordWhatsAppProviderAcceptance({
				outboxId: fixtureOutbox.id,
				messageId: fixture.message.id,
				workerId: "stale-worker",
				dispatchToken: "wrong-dispatch",
				providerMessageId: "provider-conflicting",
			}),
		).rejects.toThrow("did not match the active dispatch");
		const acceptance = await recordWhatsAppProviderAcceptance({
			outboxId: fixtureOutbox.id,
			messageId: fixture.message.id,
			workerId: "stale-worker",
			dispatchToken: "dispatch-conflict",
			providerMessageId: "provider-conflicting",
		});
		expect(acceptance.status).toBe("provider_identity_conflict");
		const [storedOutbox] = await db
			.select()
			.from(waOutbox)
			.where(eq(waOutbox.id, fixtureOutbox.id));
		const [storedMessage] = await db
			.select()
			.from(waMessages)
			.where(eq(waMessages.id, fixture.message.id));
		expect(storedOutbox.status).toBe("delivery_unknown");
		expect(storedOutbox.nextAttemptAt).toBeNull();
		expect(storedOutbox.errorMessage).toContain(
			"Provider identity conflict",
		);
		expect(storedMessage.providerMessageId).toBe("provider-original");
		expect(storedMessage.errorCode).toBe("provider_identity_conflict");
		const nextDue = await fetchDueWhatsAppOutboxItems({ limit: 100 });
		expect(nextDue.map((candidate) => candidate.outbox.id)).not.toContain(
			fixtureOutbox.id,
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
