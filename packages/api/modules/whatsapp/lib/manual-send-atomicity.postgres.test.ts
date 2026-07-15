import { describe, expect, it } from "vitest";
import type {
	ManualSendPersistenceStep,
	ManualSendRequest,
} from "./manual-send-service";

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
		"rolls back all durable effects when every persistence boundary fails",
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
			const organizationId = `wa_atomic_rollback_${suffix}`;
			const accountId = `wa_atomic_rollback_account_${suffix}`;
			try {
				await db.insert(waAccounts).values({
					id: accountId,
					organizationId,
					name: "Manual send rollback",
					provider: "cloud_api",
				});
				await db.insert(waTemplates).values({
					organizationId,
					accountId,
					name: "rollback_template",
					language: "en_US",
					status: "APPROVED",
					category: "UTILITY",
					components: [{ type: "BODY", text: "Hello" }],
				});

				const cases: Array<{
					payload: ManualSendRequest["payload"];
					steps: ManualSendPersistenceStep[];
				}> = [
					{
						payload: {
							kind: "text",
							accountId,
							to: "919999999981",
							text: "Rollback text",
						},
						steps: [
							"idempotency_claim",
							"contact",
							"conversation",
							"message",
							"activity",
							"outbox",
							"idempotency_completion",
						],
					},
					{
						payload: {
							kind: "template",
							accountId,
							to: "919999999982",
							templateName: "rollback_template",
							language: "en_US",
						},
						steps: ["message", "outbox"],
					},
					{
						payload: {
							kind: "media",
							accountId,
							to: "919999999983",
							mediaType: "image",
							mediaKey: `orgs/${organizationId}/whatsapp-media/rollback.jpg`,
							mimeType: "image/jpeg",
						},
						steps: ["media", "message", "outbox"],
					},
				];

				let attempt = 0;
				for (const testCase of cases) {
					for (const failingStep of testCase.steps) {
						attempt += 1;
						await expect(
							acceptManualWhatsAppSend(
								{
									organizationId,
									actorId: "actor_rollback",
									idempotencyKey: `wa-rollback-${suffix}-${attempt}`,
									payload: testCase.payload,
								},
								{
									afterPersist: (step) => {
										if (step === failingStep) {
											throw new Error(
												`forced ${step} failure`,
											);
										}
									},
								},
							),
						).rejects.toThrow(`forced ${failingStep} failure`);

						const rowCount = (rows: Array<{ count: unknown }>) =>
							Number(rows[0]?.count);
						const counts = [
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
							rowCount(
								await db
									.select({ count: count() })
									.from(waOutbox)
									.where(
										eq(
											waOutbox.organizationId,
											organizationId,
										),
									),
							),
							rowCount(
								await db
									.select({ count: count() })
									.from(waMessages)
									.where(
										eq(
											waMessages.organizationId,
											organizationId,
										),
									),
							),
							rowCount(
								await db
									.select({ count: count() })
									.from(waMedia)
									.where(
										eq(
											waMedia.organizationId,
											organizationId,
										),
									),
							),
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
							rowCount(
								await db
									.select({ count: count() })
									.from(waContacts)
									.where(
										eq(
											waContacts.organizationId,
											organizationId,
										),
									),
							),
						];
						expect(counts).toEqual([0, 0, 0, 0, 0, 0]);
					}
				}
			} finally {
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
