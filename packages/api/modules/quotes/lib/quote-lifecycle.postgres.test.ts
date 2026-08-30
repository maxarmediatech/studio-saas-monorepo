import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
	conversionFailureSql,
	createQuoteLifecycleFixture,
	quoteLifecycleCleanupSql,
	quoteOptionIdFor,
	restoreDatabaseUrl,
	revisionFailureSql,
} from "./quote-lifecycle.postgres-fixtures";

const databaseUrl = process.env.POSTGRES_CONCURRENCY_DATABASE_URL;
const describePostgres = databaseUrl ? describe : describe.skip;

describePostgres("quote lifecycle PostgreSQL integration", () => {
	it("serializes numbering/revision/conversion and rolls back a late conversion failure", async () => {
		const originalDatabaseUrl = process.env.DATABASE_URL;
		process.env.DATABASE_URL = databaseUrl;
		const {
			activities,
			attachments,
			bookingEvents,
			bookingParticipants,
			bookings,
			clients,
			crews,
			db,
			deliverableAssignments,
			deliverables,
			eq,
			organizations,
			paymentSchedules,
			quoteLineItems,
			quoteOptions,
			quotes,
			shootAssignments,
			shoots,
			sql,
			users,
		} = await import("@repo/database");
		const { createDraftQuote, reviseQuote, sendQuote, updateDraftQuote } =
			await import("./quote-service");
		const { acceptQuote } = await import("./quote-acceptance");
		const { convertAcceptedQuote } = await import("./quote-conversion");
		const { getOrganizationQuote, listOrganizationQuotes } = await import(
			"./quote-query"
		);
		const {
			blueprint,
			clientId,
			content,
			context,
			crewId,
			functionName,
			organizationId,
			otherClientId,
			otherOrganizationId,
			revisionFunctionName,
			revisionTriggerName,
			suffix,
			triggerName,
			userId,
		} = createQuoteLifecycleFixture();
		try {
			await db.insert(users).values({
				id: userId,
				name: context.user.name,
				email: context.user.email,
			});
			await db.insert(organizations).values([
				{
					id: organizationId,
					name: context.membership.organization.name,
					slug: context.membership.organization.slug,
				},
				{
					id: otherOrganizationId,
					name: "Other Quote Studio",
					slug: `quote-other-${suffix}`,
				},
			]);
			await db.insert(crews).values({
				id: crewId,
				organizationId,
				name: "Quote conversion crew",
				createdBy: userId,
			});
			await db.insert(clients).values([
				{ id: clientId, organizationId, name: "Valid participant" },
				{
					id: otherClientId,
					organizationId: otherOrganizationId,
					name: "Cross-tenant participant",
				},
			]);

			const numbered = await Promise.all(
				Array.from({ length: 8 }, (_, index) =>
					createDraftQuote(context, content(`Numbered ${index}`)),
				),
			);
			expect(new Set(numbered.map((item) => item.quoteNumber)).size).toBe(
				8,
			);
			expect(
				numbered.map((item) => item.quoteNumber.slice(-4)).sort(),
			).toEqual([
				"0001",
				"0002",
				"0003",
				"0004",
				"0005",
				"0006",
				"0007",
				"0008",
			]);

			const dueReadQuote = numbered[7];
			if (!dueReadQuote) {
				throw new Error("Missing due read quote fixture");
			}
			await db
				.update(quotes)
				.set({
					status: "sent",
					sentAt: new Date("2026-01-01T00:00:00.000Z"),
					expiresAt: new Date("2026-01-02T00:00:00.000Z"),
				})
				.where(eq(quotes.id, dueReadQuote.id));
			const beforeReads = await db.query.quotes.findFirst({
				where: eq(quotes.id, dueReadQuote.id),
			});
			const issuedQuotes = await listOrganizationQuotes({
				organizationId,
				includeDeleted: false,
				sortBy: "createdAt",
				sortDirection: "desc",
				page: 1,
				limit: 20,
			});
			expect(issuedQuotes.data.map((quote) => quote.id)).toEqual([
				dueReadQuote.id,
			]);
			expect(issuedQuotes.total).toBe(1);
			const workingDrafts = await listOrganizationQuotes({
				organizationId,
				statuses: ["draft"],
				includeDeleted: false,
				sortBy: "createdAt",
				sortDirection: "desc",
				page: 1,
				limit: 20,
			});
			expect(workingDrafts.total).toBe(7);
			await getOrganizationQuote(organizationId, dueReadQuote.id);
			const afterReads = await db.query.quotes.findFirst({
				where: eq(quotes.id, dueReadQuote.id),
			});
			expect(afterReads?.status).toBe("sent");
			expect(afterReads?.expiredAt).toBeNull();
			expect(afterReads?.updatedAt.toISOString()).toBe(
				beforeReads?.updatedAt.toISOString(),
			);

			await expect(
				createDraftQuote(
					context,
					content("Invalid tenant", otherClientId),
				),
			).rejects.toThrow("Active organization client(s) not found");
			expect(
				await db.query.quotes.findFirst({
					where: eq(quotes.title, "Invalid tenant quote"),
				}),
			).toBeUndefined();

			const revisionSource = numbered[0];
			if (!revisionSource) {
				throw new Error("Missing revision source fixture");
			}
			await sendQuote(context, revisionSource.id);
			await expect(
				updateDraftQuote(
					context,
					revisionSource.id,
					content("Tampered sent"),
				),
			).rejects.toThrow("Only draft quotes can be edited");
			const revisionResults = await Promise.all([
				reviseQuote(context, revisionSource.id),
				reviseQuote(context, revisionSource.id),
			]);
			expect(revisionResults[0]?.id).toBe(revisionResults[1]?.id);
			expect((await reviseQuote(context, revisionSource.id)).id).toBe(
				revisionResults[0]?.id,
			);
			const versions = await db.query.quotes.findMany({
				where: eq(quotes.quoteNumber, revisionSource.quoteNumber),
			});
			expect(versions.map((item) => item.version).sort()).toEqual([1, 2]);
			expect(versions.find((item) => item.version === 1)?.status).toBe(
				"superseded",
			);
			const revisionActivities = await db.query.activities.findMany({
				where: eq(activities.organizationId, organizationId),
			});
			expect(
				revisionActivities.some(
					(item) =>
						item.entityId === revisionResults[0]?.id &&
						item.action === "created",
				),
			).toBe(true);
			expect(
				revisionActivities.some(
					(item) =>
						item.entityId === revisionSource.id &&
						item.newValue === "superseded",
				),
			).toBe(true);

			const rollbackRevisionSource = numbered[2];
			if (!rollbackRevisionSource) {
				throw new Error("Missing revision rollback source fixture");
			}
			await sendQuote(context, rollbackRevisionSource.id);
			const revisionFailureMarker = `revision-late-failure-${suffix}`;
			await db.execute(
				sql.raw(
					revisionFailureSql({
						functionName: revisionFunctionName,
						triggerName: revisionTriggerName,
						sourceQuoteId: rollbackRevisionSource.id,
						failureMarker: revisionFailureMarker,
					}),
				),
			);
			await expect(
				reviseQuote(context, rollbackRevisionSource.id),
			).rejects.toThrow();
			expect(
				await db.query.quotes.findMany({
					where: eq(
						quotes.supersedesQuoteId,
						rollbackRevisionSource.id,
					),
				}),
			).toHaveLength(0);
			expect(
				(
					await db.query.quotes.findFirst({
						where: eq(quotes.id, rollbackRevisionSource.id),
					})
				)?.status,
			).toBe("sent");

			const conversionQuote = numbered[1];
			if (!conversionQuote) {
				throw new Error("Missing conversion quote fixture");
			}
			await sendQuote(context, conversionQuote.id);
			const acceptedOptionId = await quoteOptionIdFor(conversionQuote.id);
			const acceptedRetries = await Promise.all([
				acceptQuote(context, conversionQuote.id, acceptedOptionId),
				acceptQuote(context, conversionQuote.id, acceptedOptionId),
			]);
			expect(acceptedRetries[0]?.id).toBe(acceptedRetries[1]?.id);
			const alternateOptionId = randomUUID();
			await db.transaction(async (tx) => {
				await tx.insert(quoteOptions).values({
					id: alternateOptionId,
					organizationId,
					quoteId: conversionQuote.id,
					name: "Alternate valid option",
					subtotal: "100.00",
					totalAmount: "100.00",
					bookingBlueprintVersion: 1,
					bookingBlueprint: blueprint("Alternate valid booking"),
					sortOrder: 1,
				});
				await tx.insert(quoteLineItems).values({
					organizationId,
					quoteOptionId: alternateOptionId,
					type: "service",
					description: "Alternate coverage",
					quantity: "1.00",
					unitPrice: "100.00",
					amount: "100.00",
				});
			});
			await expect(
				acceptQuote(context, conversionQuote.id, alternateOptionId),
			).rejects.toThrow("different option");

			const mutatedBlueprint = blueprint("Mutated live booking");
			const mutatedSchedule =
				mutatedBlueprint.booking.paymentSchedules[0];
			if (!mutatedSchedule) {
				throw new Error("Missing mutated payment schedule fixture");
			}
			mutatedSchedule.amount = "200.00";
			await db.transaction(async (tx) => {
				await tx
					.update(quoteOptions)
					.set({
						subtotal: "200.00",
						totalAmount: "200.00",
						bookingBlueprint: mutatedBlueprint,
					})
					.where(eq(quoteOptions.id, acceptedOptionId));
				await tx
					.update(quoteLineItems)
					.set({ quantity: "2.00", amount: "200.00" })
					.where(eq(quoteLineItems.quoteOptionId, acceptedOptionId));
			});

			const converted = await Promise.all([
				convertAcceptedQuote(context, conversionQuote.id),
				convertAcceptedQuote(context, conversionQuote.id),
			]);
			expect(converted[0]?.id).toBe(converted[1]?.id);
			expect(
				(await convertAcceptedQuote(context, conversionQuote.id)).id,
			).toBe(converted[0]?.id);
			const sourceBookings = await db.query.bookings.findMany({
				where: eq(bookings.sourceQuoteId, conversionQuote.id),
			});
			expect(sourceBookings).toHaveLength(1);
			const bookingId = sourceBookings[0]?.id;
			const [
				participants,
				events,
				createdShoots,
				createdDeliverables,
				schedules,
				createdShootAssignments,
				createdDeliverableAssignments,
				contractAttachments,
			] = await Promise.all([
				db.query.bookingParticipants.findMany({
					where: eq(bookingParticipants.bookingId, bookingId),
				}),
				db.query.bookingEvents.findMany({
					where: eq(bookingEvents.bookingId, bookingId),
				}),
				db.query.shoots.findMany({
					where: eq(shoots.bookingId, bookingId),
				}),
				db.query.deliverables.findMany({
					where: eq(deliverables.bookingId, bookingId),
				}),
				db.query.paymentSchedules.findMany({
					where: eq(paymentSchedules.bookingId, bookingId),
				}),
				db.query.shootAssignments.findMany({
					where: eq(shootAssignments.crewId, crewId),
				}),
				db.query.deliverableAssignments.findMany({
					where: eq(deliverableAssignments.crewId, crewId),
				}),
				db.query.attachments.findMany({
					where: eq(attachments.entityId, bookingId),
				}),
			]);
			expect([
				participants.length,
				events.length,
				createdShoots.length,
				createdDeliverables.length,
				schedules.length,
				createdShootAssignments.length,
				createdDeliverableAssignments.length,
				contractAttachments.length,
			]).toEqual([1, 1, 1, 1, 1, 1, 1, 1]);
			expect(contractAttachments[0]?.description).toBe("contract");
			expect(sourceBookings[0]?.packageCost).toBe("100.00");
			expect(sourceBookings[0]?.name).toBe("Numbered 1");
			expect(schedules[0]?.amount).toBe("100.00");
			await expect(
				db
					.update(quoteOptions)
					.set({ subtotal: "300.00", totalAmount: "300.00" })
					.where(eq(quoteOptions.id, acceptedOptionId)),
			).rejects.toThrow();
			const conversionActivities = await db.query.activities.findMany({
				where: eq(activities.organizationId, organizationId),
			});
			expect(
				conversionActivities.some(
					(item) =>
						item.entityType === "booking" &&
						item.entityId === bookingId &&
						item.action === "created",
				),
			).toBe(true);
			expect(
				conversionActivities.some(
					(item) =>
						item.entityId === conversionQuote.id &&
						item.newValue === "converted",
				),
			).toBe(true);

			const deletedAt = new Date();
			await db
				.update(bookings)
				.set({ deletedAt })
				.where(eq(bookings.id, bookingId));
			const deletedRetry = await convertAcceptedQuote(
				context,
				conversionQuote.id,
			);
			expect(deletedRetry.id).toBe(bookingId);
			expect(deletedRetry.deletedAt?.toISOString()).toBe(
				deletedAt.toISOString(),
			);
			await expect(
				db.insert(bookings).values({
					organizationId,
					referenceNumber: `DUPLICATE-${suffix}`,
					name: "Duplicate provenance",
					bookingType: "wedding",
					packageType: "premium",
					packageCost: "100.00",
					sourceQuoteId: conversionQuote.id,
					sourceQuoteOptionId: acceptedOptionId,
					sourceQuoteNumber: conversionQuote.quoteNumber,
					sourceQuoteVersion: 1,
					sourceBookingBlueprintVersion: 1,
				}),
			).rejects.toThrow();

			const failureMarker = `late-failure-${suffix}`;
			const rollbackQuote = await createDraftQuote(
				context,
				content("Rollback", clientId, failureMarker),
			);
			await sendQuote(context, rollbackQuote.id);
			await acceptQuote(
				context,
				rollbackQuote.id,
				await quoteOptionIdFor(rollbackQuote.id),
			);
			const bookingActivityCountBeforeRollback = (
				await db.query.activities.findMany({
					where: eq(activities.organizationId, organizationId),
				})
			).filter((item) => item.entityType === "booking").length;
			await db.execute(
				sql.raw(
					conversionFailureSql({
						functionName,
						triggerName,
						quoteId: rollbackQuote.id,
						failureMarker,
					}),
				),
			);
			try {
				await convertAcceptedQuote(context, rollbackQuote.id);
				expect.unreachable("Expected forced late conversion failure");
			} catch (error) {
				const cause = (error as { cause?: Error }).cause;
				expect(cause?.message ?? String(error)).toContain(
					failureMarker,
				);
			}
			expect(
				await db.query.bookings.findMany({
					where: eq(bookings.sourceQuoteId, rollbackQuote.id),
				}),
			).toHaveLength(0);
			expect(
				(
					await db.query.quotes.findFirst({
						where: eq(quotes.id, rollbackQuote.id),
					})
				)?.status,
			).toBe("accepted");
			const bookingActivityCountAfterRollback = (
				await db.query.activities.findMany({
					where: eq(activities.organizationId, organizationId),
				})
			).filter((item) => item.entityType === "booking").length;
			expect(bookingActivityCountAfterRollback).toBe(
				bookingActivityCountBeforeRollback,
			);
		} finally {
			await db.execute(
				sql.raw(
					quoteLifecycleCleanupSql(
						triggerName,
						functionName,
						revisionTriggerName,
						revisionFunctionName,
					),
				),
			);
			await db
				.delete(organizations)
				.where(eq(organizations.id, otherOrganizationId));
			await db
				.delete(organizations)
				.where(eq(organizations.id, organizationId));
			await db.delete(users).where(eq(users.id, userId));
			restoreDatabaseUrl(originalDatabaseUrl);
		}
	}, 60_000);
});
