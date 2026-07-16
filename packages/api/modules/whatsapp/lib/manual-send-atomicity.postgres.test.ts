import type { SendTemplateParams, WhatsAppProvider } from "@repo/whatsapp-core";
import { describe, expect, it, vi } from "vitest";
import type { ManualSendRequest } from "./manual-send-service";

const triggerMocks = vi.hoisted(() => ({ trigger: vi.fn() }));

vi.mock("@trigger.dev/sdk/v3", () => ({
	tasks: { trigger: triggerMocks.trigger },
}));

const databaseUrl = process.env.POSTGRES_CONCURRENCY_DATABASE_URL;
const describePostgres = databaseUrl ? describe : describe.skip;
const postgresTestTimeout = 30_000;

describePostgres("manual WhatsApp send atomicity", () => {
	it(
		"commits every send kind with projections, outbox, and completed claim",
		async () => {
			const originalDatabaseUrl = process.env.DATABASE_URL;
			process.env.DATABASE_URL = databaseUrl;
			const {
				count,
				db,
				eq,
				waAccounts,
				waContacts,
				waConversations,
				waManualSendIdempotency,
				waMedia,
				waMessages,
				waOutbox,
				waTemplates,
			} = await import("@repo/database");
			const { acceptManualWhatsAppSend } = await import(
				"./manual-send-service"
			);
			const suffix = `${process.pid}_${Date.now()}`;
			const organizationId = `wa_atomic_commit_${suffix}`;
			const accountId = `wa_atomic_account_${suffix}`;

			try {
				await db.insert(waAccounts).values({
					id: accountId,
					organizationId,
					name: "Manual send atomicity",
					provider: "cloud_api",
				});
				await db.insert(waTemplates).values({
					organizationId,
					accountId,
					name: "booking_confirmation",
					language: "en_US",
					status: "APPROVED",
					category: "UTILITY",
					components: [{ type: "BODY", text: "Booking confirmed" }],
				});

				const requests: ManualSendRequest[] = [
					{
						organizationId,
						actorId: "actor_1",
						idempotencyKey: `wa-text-${suffix}`,
						payload: {
							kind: "text",
							accountId,
							to: "919999999991",
							text: "Hello",
							contactName: "Text contact",
						},
					},
					{
						organizationId,
						actorId: "actor_1",
						idempotencyKey: `wa-template-${suffix}`,
						payload: {
							kind: "template",
							accountId,
							to: "919999999992",
							templateName: "booking_confirmation",
							language: "en_US",
						},
					},
					{
						organizationId,
						actorId: "actor_1",
						idempotencyKey: `wa-media-${suffix}`,
						payload: {
							kind: "media",
							accountId,
							to: "919999999993",
							mediaType: "image",
							mediaKey: `orgs/${organizationId}/whatsapp-media/photo.jpg`,
							mimeType: "image/jpeg",
							caption: "Portfolio",
							fileName: "photo.jpg",
						},
					},
				];

				const results = await Promise.all(
					requests.map((request) =>
						acceptManualWhatsAppSend(request),
					),
				);
				expect(results.every(({ replayed }) => !replayed)).toBe(true);

				const rowCount = (rows: Array<{ count: unknown }>) =>
					Number(rows[0]?.count);
				expect(
					rowCount(
						await db
							.select({ count: count() })
							.from(waManualSendIdempotency)
							.where(
								eq(
									waManualSendIdempotency.organizationId,
									organizationId,
								),
							),
					),
				).toBe(3);
				expect(
					rowCount(
						await db
							.select({ count: count() })
							.from(waMessages)
							.where(
								eq(waMessages.organizationId, organizationId),
							),
					),
				).toBe(3);
				expect(
					rowCount(
						await db
							.select({ count: count() })
							.from(waOutbox)
							.where(eq(waOutbox.organizationId, organizationId)),
					),
				).toBe(3);
				expect(
					rowCount(
						await db
							.select({ count: count() })
							.from(waContacts)
							.where(
								eq(waContacts.organizationId, organizationId),
							),
					),
				).toBe(3);
				expect(
					rowCount(
						await db
							.select({ count: count() })
							.from(waConversations)
							.where(
								eq(
									waConversations.organizationId,
									organizationId,
								),
							),
					),
				).toBe(3);
				const claims = await db
					.select()
					.from(waManualSendIdempotency)
					.where(
						eq(
							waManualSendIdempotency.organizationId,
							organizationId,
						),
					);
				expect(
					claims.every((claim) => claim.status === "completed"),
				).toBe(true);
				expect(
					claims.every(
						(claim) =>
							Boolean(claim.messageId) && Boolean(claim.outboxId),
					),
				).toBe(true);
				const messages = await db
					.select()
					.from(waMessages)
					.where(eq(waMessages.organizationId, organizationId));
				expect(messages.map(({ type }) => type).sort()).toEqual([
					"image",
					"template",
					"text",
				]);
				expect(
					messages.every(
						({ sentByUserId }) => sentByUserId === "actor_1",
					),
				).toBe(true);
				const [media] = await db
					.select({ count: count() })
					.from(waMedia)
					.where(eq(waMedia.organizationId, organizationId));
				expect(Number(media?.count)).toBe(1);
			} finally {
				await db
					.delete(waManualSendIdempotency)
					.where(
						eq(
							waManualSendIdempotency.organizationId,
							organizationId,
						),
					);
				await db
					.delete(waOutbox)
					.where(eq(waOutbox.organizationId, organizationId));
				await db
					.delete(waMessages)
					.where(eq(waMessages.organizationId, organizationId));
				await db
					.delete(waMedia)
					.where(eq(waMedia.organizationId, organizationId));
				await db
					.delete(waConversations)
					.where(eq(waConversations.organizationId, organizationId));
				await db
					.delete(waContacts)
					.where(eq(waContacts.organizationId, organizationId));
				await db
					.delete(waTemplates)
					.where(eq(waTemplates.organizationId, organizationId));
				await db
					.delete(waAccounts)
					.where(eq(waAccounts.organizationId, organizationId));
				process.env.DATABASE_URL = originalDatabaseUrl;
			}
		},
		postgresTestTimeout,
	);

	it(
		"polls and sends the exact durable row once when Trigger wake-up fails",
		async () => {
			const originalDatabaseUrl = process.env.DATABASE_URL;
			process.env.DATABASE_URL = databaseUrl;
			const {
				db,
				eq,
				waAccounts,
				waContacts,
				waConversations,
				waManualSendIdempotency,
				waMessages,
				waOutbox,
				waTemplates,
			} = await import("@repo/database");
			const { fetchDueWhatsAppOutboxItems, processWhatsAppOutboxItem } =
				await import("@repo/whatsapp-outbox");
			const { acceptManualWhatsAppSend } = await import(
				"./manual-send-service"
			);
			const { triggerWhatsAppOutbox } = await import("./trigger-outbox");
			const suffix = `${process.pid}_${Date.now()}`;
			const organizationId = `wa_atomic_poller_${suffix}`;
			const accountId = `wa_atomic_poller_account_${suffix}`;
			let providerCalls = 0;
			let providerTemplate: SendTemplateParams | undefined;

			try {
				await db.insert(waAccounts).values({
					id: accountId,
					organizationId,
					name: "Manual send poller fallback",
					provider: "cloud_api",
					connectionStatus: "connected",
				});
				await db.insert(waTemplates).values({
					organizationId,
					accountId,
					name: "dynamic_booking_link",
					language: "en_US",
					status: "APPROVED",
					category: "UTILITY",
					components: [{ type: "BUTTONS" }],
				});

				const accepted = await acceptManualWhatsAppSend({
					organizationId,
					actorId: "actor_poller",
					idempotencyKey: `wa-poller-${suffix}`,
					payload: {
						kind: "template",
						accountId,
						to: "919999999977",
						templateName: "dynamic_booking_link",
						language: "en_US",
						components: [
							{
								type: "button",
								subType: "url",
								index: 1,
								parameters: [
									{ type: "text", text: "booking-42" },
								],
							},
						],
					},
				});

				triggerMocks.trigger.mockRejectedValueOnce(
					new Error("Trigger unavailable"),
				);
				expect(
					await triggerWhatsAppOutbox({
						outboxId: accepted.outboxId,
					}),
				).toBe(false);

				const due = await fetchDueWhatsAppOutboxItems({ limit: 100 });
				const exactItem = due.find(
					(item) => item.outbox.id === accepted.outboxId,
				);
				if (!exactItem) {
					throw new Error(
						"Accepted manual send was not found by poller",
					);
				}

				const provider = {
					type: "cloud_api",
					capabilities: new Set(["templates"] as const),
					provisioning: {
						startLink: async () => ({
							status: "connected" as const,
						}),
						getStatus: async () => "connected" as const,
						disconnect: async () => undefined,
					},
					messaging: {
						sendText: async () => ({ success: false }),
						sendMedia: async () => ({ success: false }),
						sendTemplate: async (params: SendTemplateParams) => {
							providerCalls += 1;
							providerTemplate = params;
							return {
								success: true,
								providerMessageId: "provider-poller-once",
							};
						},
						markRead: async () => undefined,
						supports: () => true,
					},
					destroy: async () => undefined,
				} satisfies WhatsAppProvider;
				expect(
					await processWhatsAppOutboxItem(exactItem, {
						workerId: "manual-send-poller",
						providerFactory: () => provider,
					}),
				).toEqual({ status: "sent" });
				expect(providerCalls).toBe(1);
				expect(providerTemplate).toMatchObject({
					to: "919999999977",
					templateName: "dynamic_booking_link",
					language: "en_US",
					components: [
						{
							type: "button",
							subType: "url",
							index: 1,
							parameters: [{ type: "text", text: "booking-42" }],
						},
					],
				});

				const nextDue = await fetchDueWhatsAppOutboxItems({
					limit: 100,
				});
				expect(
					nextDue.some(
						(item) => item.outbox.id === accepted.outboxId,
					),
				).toBe(false);
				const storedMessage = await db.query.waMessages.findFirst({
					where: eq(waMessages.id, accepted.messageId),
				});
				expect(storedMessage).toMatchObject({
					status: "sent",
					providerMessageId: "provider-poller-once",
				});
			} finally {
				triggerMocks.trigger.mockReset();
				await db
					.delete(waManualSendIdempotency)
					.where(
						eq(
							waManualSendIdempotency.organizationId,
							organizationId,
						),
					);
				await db
					.delete(waOutbox)
					.where(eq(waOutbox.organizationId, organizationId));
				await db
					.delete(waMessages)
					.where(eq(waMessages.organizationId, organizationId));
				await db
					.delete(waConversations)
					.where(eq(waConversations.organizationId, organizationId));
				await db
					.delete(waContacts)
					.where(eq(waContacts.organizationId, organizationId));
				await db
					.delete(waTemplates)
					.where(eq(waTemplates.organizationId, organizationId));
				await db
					.delete(waAccounts)
					.where(eq(waAccounts.organizationId, organizationId));
				process.env.DATABASE_URL = originalDatabaseUrl;
			}
		},
		postgresTestTimeout,
	);
});
