import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";

const databaseUrl = process.env.POSTGRES_CONCURRENCY_DATABASE_URL;
const describePostgres = databaseUrl ? describe : describe.skip;

function restoreDatabaseUrl(original: string | undefined) {
	if (original === undefined) {
		delete process.env.DATABASE_URL;
		return;
	}
	process.env.DATABASE_URL = original;
}

describePostgres(
	"booking reference and quote provenance PostgreSQL guards",
	() => {
		it("enforces blueprint and source provenance constraints", async () => {
			const originalDatabaseUrl = process.env.DATABASE_URL;
			process.env.DATABASE_URL = databaseUrl;
			const {
				bookings,
				clients,
				db,
				eq,
				organizations,
				quoteAcceptances,
				quoteLineItems,
				quoteOptions,
				quoteParticipants,
				quotes,
			} = await import("@repo/database");
			const suffix = `${process.pid}_${Date.now()}`;
			const organizationId = `booking_provenance_org_${suffix}`;
			const quoteId = `booking_provenance_quote_${suffix}`;
			const optionId = `booking_provenance_option_${suffix}`;
			const blueprint = {
				schemaVersion: 1,
				booking: {
					name: "Provenance booking",
					bookingDate: "2026-04-22",
					bookingType: "test",
					packageType: "test",
				},
			};

			try {
				await db.insert(organizations).values({
					id: organizationId,
					name: "Provenance Studio",
					slug: `booking-provenance-${suffix}`,
				});
				await db.insert(quotes).values({
					id: quoteId,
					organizationId,
					quoteNumber: `Q-${suffix}`,
					title: "Provenance quote",
				});
				const clientIds = [
					`primary_a_${suffix}`,
					`primary_b_${suffix}`,
				];
				await db.insert(clients).values(
					clientIds.map((id, index) => ({
						id,
						organizationId,
						name: `Primary client ${index}`,
					})),
				);
				await db.insert(quoteParticipants).values({
					organizationId,
					quoteId,
					clientId: clientIds[0] as string,
					role: "primary-a",
					isPrimary: true,
				});
				await expect(
					db.insert(quoteParticipants).values({
						organizationId,
						quoteId,
						clientId: clientIds[1] as string,
						role: "primary-b",
						isPrimary: true,
					}),
				).rejects.toThrow();
				const invalidBlueprintCases = [
					{
						id: `root_array_${optionId}`,
						name: "Non-object blueprint",
						bookingBlueprintVersion: 1,
						bookingBlueprint: [1],
					},
					{
						id: `missing_booking_${optionId}`,
						name: "Missing booking object",
						bookingBlueprintVersion: 1,
						bookingBlueprint: { schemaVersion: 1 },
					},
					{
						id: `string_booking_${optionId}`,
						name: "Non-object booking",
						bookingBlueprintVersion: 1,
						bookingBlueprint: {
							schemaVersion: 1,
							booking: "not-an-object",
						},
					},
					{
						id: `missing_${optionId}`,
						name: "Missing blueprint version",
						bookingBlueprintVersion: 1,
						bookingBlueprint: { booking: blueprint.booking },
					},
					{
						id: `string_${optionId}`,
						name: "String blueprint version",
						bookingBlueprintVersion: 1,
						bookingBlueprint: { ...blueprint, schemaVersion: "1" },
					},
					{
						id: `mismatch_${optionId}`,
						name: "Mismatched blueprint version",
						bookingBlueprintVersion: 2,
						bookingBlueprint: blueprint,
					},
				];
				for (const invalid of invalidBlueprintCases) {
					await expect(
						db.insert(quoteOptions).values({
							...invalid,
							organizationId,
							quoteId,
						}),
					).rejects.toThrow();
				}
				await db.transaction(async (tx) => {
					await tx.insert(quoteOptions).values({
						id: optionId,
						organizationId,
						quoteId,
						name: "Accepted option",
						subtotal: "100.00",
						totalAmount: "100.00",
						bookingBlueprintVersion: 1,
						bookingBlueprint: blueprint,
					});
					await tx.insert(quoteLineItems).values({
						organizationId,
						quoteOptionId: optionId,
						type: "expense",
						description: "Package",
						amount: "100.00",
					});
				});
				await db.insert(quoteAcceptances).values({
					quoteId,
					organizationId,
					quoteOptionId: optionId,
					optionSnapshot: {
						quoteId,
						quoteOptionId: optionId,
						quoteNumber: `Q-${suffix}`,
						quoteVersion: 1,
						option: {
							totalAmount: "100.00",
							bookingBlueprint: blueprint,
						},
					},
					acceptedAt: new Date(),
				});
				await db.insert(quoteOptions).values({
					id: `recommended_a_${optionId}`,
					organizationId,
					quoteId,
					name: "Recommended A",
					bookingBlueprintVersion: 1,
					bookingBlueprint: blueprint,
					isRecommended: true,
					sortOrder: 1,
				});
				await expect(
					db.insert(quoteOptions).values({
						id: `recommended_b_${optionId}`,
						organizationId,
						quoteId,
						name: "Recommended B",
						bookingBlueprintVersion: 1,
						bookingBlueprint: blueprint,
						isRecommended: true,
						sortOrder: 2,
					}),
				).rejects.toThrow();

				const bookingValues = {
					organizationId,
					name: "Provenance booking",
					bookingType: "test",
					packageType: "test",
					packageCost: "100.00",
					sourceQuoteId: quoteId,
					sourceQuoteOptionId: optionId,
					sourceQuoteNumber: `Q-${suffix}`,
					sourceQuoteVersion: 1,
					sourceBookingBlueprintVersion: 1,
				};
				await db.insert(bookings).values({
					...bookingValues,
					referenceNumber: `PROVENANCE-${suffix}`,
				});
				await expect(
					db.insert(bookings).values({
						...bookingValues,
						referenceNumber: `DUPLICATE-${suffix}`,
					}),
				).rejects.toThrow();
			} finally {
				await db
					.delete(organizations)
					.where(eq(organizations.id, organizationId));
				restoreDatabaseUrl(originalDatabaseUrl);
			}
		});

		it("rolls back a materialized booking graph after a late DB failure", async () => {
			const originalDatabaseUrl = process.env.DATABASE_URL;
			process.env.DATABASE_URL = databaseUrl;
			const {
				bookingEvents,
				bookingParticipants,
				bookings,
				clients,
				db,
				deliverables,
				eq,
				organizations,
				paymentSchedules,
				quoteAcceptances,
				quoteLineItems,
				quoteOptions,
				quotes,
				shoots,
				sql,
				users,
			} = await import("@repo/database");
			const { materializeBooking } = await import(
				"../lib/materialize-booking"
			);
			const suffix = `${process.pid}_${Date.now()}`;
			const organizationId = `materialize_rollback_org_${suffix}`;
			const clientId = randomUUID();
			const userId = `materialize_rollback_user_${suffix}`;
			const quoteId = `materialize_rollback_quote_${suffix}`;
			const optionId = `materialize_rollback_option_${suffix}`;
			const triggerName = `materialize_rollback_trigger_${suffix}`;
			const functionName = `materialize_rollback_fn_${suffix}`;
			const failureMarker = `late-failure-${suffix}`;
			const blueprint = {
				schemaVersion: 1 as const,
				booking: {
					name: "Rollback graph",
					bookingDate: "2026-04-22",
					bookingType: "test",
					packageType: "test",
				},
			};

			try {
				await db.insert(users).values({
					id: userId,
					name: "Materialize rollback user",
					email: `materialize-rollback-${suffix}@example.com`,
				});
				await db.insert(organizations).values({
					id: organizationId,
					name: "Materialize Rollback Studio",
					slug: `materialize-rollback-${suffix}`,
				});
				await db.insert(clients).values({
					id: clientId,
					organizationId,
					name: "Rollback client",
				});
				await db.insert(quotes).values({
					id: quoteId,
					organizationId,
					quoteNumber: `Q-ROLLBACK-${suffix}`,
					title: "Rollback quote",
				});
				await db.transaction(async (tx) => {
					await tx.insert(quoteOptions).values({
						id: optionId,
						organizationId,
						quoteId,
						name: "Rollback option",
						subtotal: "100.00",
						totalAmount: "100.00",
						bookingBlueprintVersion: 1,
						bookingBlueprint: blueprint,
					});
					await tx.insert(quoteLineItems).values({
						organizationId,
						quoteOptionId: optionId,
						type: "expense",
						description: "Package",
						amount: "100.00",
					});
				});
				await db.insert(quoteAcceptances).values({
					quoteId,
					organizationId,
					quoteOptionId: optionId,
					optionSnapshot: {
						quoteId,
						quoteOptionId: optionId,
						quoteNumber: `Q-ROLLBACK-${suffix}`,
						quoteVersion: 1,
						option: {
							totalAmount: "100.00",
							bookingBlueprint: blueprint,
						},
					},
					acceptedAt: new Date(),
				});
				await db.execute(
					sql.raw(`
						CREATE FUNCTION ${functionName}() RETURNS trigger LANGUAGE plpgsql AS $$
						BEGIN
							IF NEW.notes = '${failureMarker}' THEN
								IF NOT EXISTS (SELECT 1 FROM booking_participants WHERE booking_id = NEW.booking_id)
									OR NOT EXISTS (SELECT 1 FROM booking_events WHERE booking_id = NEW.booking_id)
									OR NOT EXISTS (SELECT 1 FROM shoots WHERE booking_id = NEW.booking_id)
									OR NOT EXISTS (SELECT 1 FROM deliverables WHERE booking_id = NEW.booking_id) THEN
									RAISE EXCEPTION 'materialization children missing before late failure';
								END IF;
								RAISE EXCEPTION 'forced late materialization failure';
							END IF;
							RETURN NEW;
						END;
						$$;
						CREATE TRIGGER ${triggerName}
						BEFORE INSERT ON payment_schedules
						FOR EACH ROW EXECUTE FUNCTION ${functionName}();
					`),
				);

				try {
					await db.transaction((tx) =>
						materializeBooking(
							tx,
							{
								organizationId,
								organizationName: "Materialize Rollback Studio",
								userId,
							},
							{
								name: "Rollback graph",
								bookingDate: "2026-04-22",
								bookingType: "test",
								packageType: "test",
								packageCost: "100.00",
								participants: [{ clientId, role: "primary" }],
								events: [
									{
										eventType: "ceremony",
										eventDate: "2026-04-22T10:00:00.000Z",
									},
								],
								shoots: [
									{
										name: "Rollback shoot",
										shootType: "test",
										shootDate: "2026-04-22",
										status: "scheduled",
									},
								],
								deliverables: [
									{
										name: "Rollback deliverable",
										quantity: 1,
										isPackageIncluded: true,
									},
								],
								paymentSchedules: [
									{
										name: "Rollback payment",
										amount: "100.00",
										dueDate: "2026-04-01",
										notes: failureMarker,
										sortOrder: 0,
									},
								],
							},
							{
								provenance: {
									quoteId,
									quoteOptionId: optionId,
									quoteNumber: `Q-ROLLBACK-${suffix}`,
									quoteVersion: 1,
									bookingBlueprint: blueprint,
								},
							},
						),
					);
					expect.unreachable("Expected late DB failure");
				} catch (error) {
					const cause = (error as { cause?: Error }).cause;
					expect(cause?.message ?? String(error)).toContain(
						"forced late materialization failure",
					);
				}

				const [
					root,
					participants,
					events,
					createdShoots,
					createdDeliverables,
					schedules,
				] = await Promise.all([
					db.query.bookings.findMany({
						where: eq(bookings.organizationId, organizationId),
					}),
					db.query.bookingParticipants.findMany({
						where: eq(bookingParticipants.clientId, clientId),
					}),
					db.query.bookingEvents.findMany({
						where: eq(bookingEvents.organizationId, organizationId),
					}),
					db.query.shoots.findMany({
						where: eq(shoots.organizationId, organizationId),
					}),
					db.query.deliverables.findMany({
						where: eq(deliverables.organizationId, organizationId),
					}),
					db.query.paymentSchedules.findMany({
						where: eq(
							paymentSchedules.organizationId,
							organizationId,
						),
					}),
				]);
				expect(root).toHaveLength(0);
				expect(participants).toHaveLength(0);
				expect(events).toHaveLength(0);
				expect(createdShoots).toHaveLength(0);
				expect(createdDeliverables).toHaveLength(0);
				expect(schedules).toHaveLength(0);
			} finally {
				await db.execute(
					sql.raw(
						`DROP TRIGGER IF EXISTS ${triggerName} ON payment_schedules`,
					),
				);
				await db.execute(
					sql.raw(`DROP FUNCTION IF EXISTS ${functionName}()`),
				);
				await db
					.delete(organizations)
					.where(eq(organizations.id, organizationId));
				await db.delete(users).where(eq(users.id, userId));
				restoreDatabaseUrl(originalDatabaseUrl);
			}
		});
	},
);
