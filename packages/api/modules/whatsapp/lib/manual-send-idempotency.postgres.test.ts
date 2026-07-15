import { describe, expect, it } from "vitest";

const databaseUrl = process.env.POSTGRES_CONCURRENCY_DATABASE_URL;
const describePostgres = databaseUrl ? describe : describe.skip;
const postgresTestTimeout = 30_000;

describePostgres("manual WhatsApp send idempotency", () => {
	it(
		"replays retries, conflicts on changed payload, and isolates every scope",
		async () => {
			const originalDatabaseUrl = process.env.DATABASE_URL;
			process.env.DATABASE_URL = databaseUrl;
			const {
				and,
				count,
				db,
				eq,
				waAccounts,
				waContacts,
				waConversations,
				waManualSendIdempotency,
				waMessages,
				waOutbox,
			} = await import("@repo/database");
			const {
				acceptManualWhatsAppSend,
				MANUAL_SEND_IDEMPOTENCY_CONFLICT_MESSAGE,
			} = await import("./manual-send-service");
			const suffix = `${process.pid}_${Date.now()}`;
			const organizationId = `wa_idem_org_${suffix}`;
			const otherOrganizationId = `wa_idem_other_org_${suffix}`;
			const accountId = `wa_idem_account_${suffix}`;
			const otherAccountId = `wa_idem_other_account_${suffix}`;
			const crossOrganizationAccountId = `wa_idem_cross_org_account_${suffix}`;
			const idempotencyKey = `wa-idempotency-${suffix}`;
			const scopedOrganizations = [organizationId, otherOrganizationId];

			try {
				await db.insert(waAccounts).values([
					{
						id: accountId,
						organizationId,
						name: "Idempotency account",
						provider: "cloud_api",
					},
					{
						id: otherAccountId,
						organizationId,
						name: "Other account",
						provider: "cloud_api",
					},
					{
						id: crossOrganizationAccountId,
						organizationId: otherOrganizationId,
						name: "Other organization account",
						provider: "cloud_api",
					},
				]);

				const baseRequest = {
					organizationId,
					actorId: "actor_1",
					idempotencyKey,
					payload: {
						kind: "text" as const,
						accountId,
						to: "919999999999",
						text: "Only one message",
						contactName: "Idempotent contact",
					},
				};
				const send = () => acceptManualWhatsAppSend(baseRequest);

				const concurrent = await Promise.all([send(), send()]);
				expect(
					new Set(concurrent.map(({ messageId }) => messageId)).size,
				).toBe(1);
				expect(
					new Set(concurrent.map(({ outboxId }) => outboxId)).size,
				).toBe(1);
				expect(
					concurrent.map(({ replayed }) => replayed).sort(),
				).toEqual([false, true]);

				// Simulates a client losing the first API response and retrying later.
				const responseLossRetry = await send();
				expect(responseLossRetry).toEqual({
					...concurrent[0],
					replayed: true,
				});
				await expect(
					acceptManualWhatsAppSend({
						...baseRequest,
						payload: {
							...baseRequest.payload,
							text: "Changed payload",
						},
					}),
				).rejects.toThrow(MANUAL_SEND_IDEMPOTENCY_CONFLICT_MESSAGE);

				const rowCount = (rows: Array<{ count: unknown }>) =>
					Number(rows[0]?.count);
				const originalEffectCounts = [
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
							.from(waMessages)
							.where(
								eq(waMessages.organizationId, organizationId),
							),
					),
					rowCount(
						await db
							.select({ count: count() })
							.from(waOutbox)
							.where(eq(waOutbox.organizationId, organizationId)),
					),
					rowCount(
						await db
							.select({ count: count() })
							.from(waContacts)
							.where(
								eq(waContacts.organizationId, organizationId),
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
				];
				expect(originalEffectCounts).toEqual([1, 1, 1, 1, 1]);

				const otherAccount = await acceptManualWhatsAppSend({
					...baseRequest,
					payload: {
						...baseRequest.payload,
						accountId: otherAccountId,
					},
				});
				const otherActor = await acceptManualWhatsAppSend({
					...baseRequest,
					actorId: "actor_2",
				});
				const otherOrganization = await acceptManualWhatsAppSend({
					...baseRequest,
					organizationId: otherOrganizationId,
					payload: {
						...baseRequest.payload,
						accountId: crossOrganizationAccountId,
					},
				});

				for (const accepted of [
					otherAccount,
					otherActor,
					otherOrganization,
				]) {
					expect(accepted.replayed).toBe(false);
					expect(accepted.messageId).not.toBe(
						concurrent[0]?.messageId,
					);
					expect(accepted.outboxId).not.toBe(concurrent[0]?.outboxId);
				}

				const [baseScopeClaims] = await db
					.select({ count: count() })
					.from(waManualSendIdempotency)
					.where(
						and(
							eq(
								waManualSendIdempotency.organizationId,
								organizationId,
							),
							eq(
								waManualSendIdempotency.idempotencyKey,
								idempotencyKey,
							),
						),
					);
				expect(Number(baseScopeClaims?.count)).toBe(3);
				const crossOrgClaim =
					await db.query.waManualSendIdempotency.findFirst({
						where: and(
							eq(
								waManualSendIdempotency.organizationId,
								otherOrganizationId,
							),
							eq(
								waManualSendIdempotency.idempotencyKey,
								idempotencyKey,
							),
						),
					});
				expect(crossOrgClaim?.messageId).toBe(
					otherOrganization.messageId,
				);
			} finally {
				for (const organization of scopedOrganizations) {
					await db
						.delete(waManualSendIdempotency)
						.where(
							eq(
								waManualSendIdempotency.organizationId,
								organization,
							),
						);
					await db
						.delete(waOutbox)
						.where(eq(waOutbox.organizationId, organization));
					await db
						.delete(waMessages)
						.where(eq(waMessages.organizationId, organization));
					await db
						.delete(waConversations)
						.where(
							eq(waConversations.organizationId, organization),
						);
					await db
						.delete(waContacts)
						.where(eq(waContacts.organizationId, organization));
					await db
						.delete(waAccounts)
						.where(eq(waAccounts.organizationId, organization));
				}
				process.env.DATABASE_URL = originalDatabaseUrl;
			}
		},
		postgresTestTimeout,
	);
});
