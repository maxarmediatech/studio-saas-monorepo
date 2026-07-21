import { describe, expect, it, vi } from "vitest";

const databaseUrl = process.env.POSTGRES_CONCURRENCY_DATABASE_URL;
const describePostgres = databaseUrl ? describe : describe.skip;

const permissionMocks = vi.hoisted(() => ({
	hasPermission: vi.fn(),
	requirePermission: vi.fn(),
}));

vi.mock("./permissions", () => ({
	hasPermission: permissionMocks.hasPermission,
	requirePermission: permissionMocks.requirePermission,
}));

describePostgres("entity search PostgreSQL integration", () => {
	it("covers booking list relationships, labels, references, and permissions", async () => {
		const originalDatabaseUrl = process.env.DATABASE_URL;
		process.env.DATABASE_URL = databaseUrl;

		const {
			bookingParticipants,
			bookings,
			clients,
			configurations,
			db,
			deliverables,
			eq,
			organizations,
			receivedAmounts,
			shoots,
		} = await import("@repo/database");
		const { listBookings } = await import(
			"../../bookings/procedures/list-bookings"
		);
		const { searchDeliverables } = await import(
			"../../global-search/lib/entity-searchers/search-deliverables"
		);
		const { searchShoots } = await import(
			"../../global-search/lib/entity-searchers/search-shoots"
		);

		const suffix = `${process.pid}_${Date.now()}`;
		const organizationId = `search_org_${suffix}`;
		const otherOrganizationId = `search_other_org_${suffix}`;
		const bookingId = `search_booking_${suffix}`;
		const clientId = `search_client_${suffix}`;
		const shootId = `search_shoot_${suffix}`;
		const deliverableId = `search_deliverable_${suffix}`;
		const context = { headers: new Headers(), organizationId };
		const callList = (search: string) =>
			(listBookings as any)["~orpc"].handler({
				context,
				input: {
					page: 1,
					limit: 10,
					search,
					sortBy: "bookingDate",
					sortDirection: "desc",
					includeDeleted: false,
				},
			});

		permissionMocks.requirePermission.mockResolvedValue(undefined);

		try {
			await db.insert(organizations).values([
				{
					id: organizationId,
					name: "Search regression organization",
					slug: `search-regression-${suffix}`,
				},
				{
					id: otherOrganizationId,
					name: "Other search organization",
					slug: `search-other-${suffix}`,
				},
			]);
			await db.insert(configurations).values([
				{
					organizationId,
					type: "booking_type",
					key: "wedding",
					label: "Matrimony Coverage",
				},
				{
					organizationId,
					type: "package_type",
					key: "basic",
					label: "Starter Collection",
				},
				{
					organizationId,
					type: "event_type",
					key: "baby_shoot",
					label: "Infant Story",
				},
				{
					organizationId: otherOrganizationId,
					type: "package_type",
					key: "basic",
					label: "Other Organization Package",
				},
			]);
			await db.insert(clients).values({
				id: clientId,
				organizationId,
				name: "Searchable Client",
			});
			await db.insert(bookings).values({
				id: bookingId,
				organizationId,
				referenceNumber: "RAK-2604-0001",
				name: "Search regression booking",
				bookingType: "wedding",
				packageType: "basic",
				packageCost: "125000.00",
				totalReceived: "25000.00",
			});
			await db.insert(bookingParticipants).values({
				bookingId,
				clientId,
				role: "client",
			});
			await db.insert(receivedAmounts).values({
				organizationId,
				bookingId,
				amount: "12345.00",
				paymentMethod: "bank_transfer",
				receivedDate: "2026-07-21",
			});
			await db.insert(shoots).values({
				id: shootId,
				organizationId,
				bookingId,
				name: "Search regression shoot",
				shootType: "baby_shoot",
				shootDate: "2026-07-21",
			});
			await db.insert(deliverables).values({
				id: deliverableId,
				organizationId,
				bookingId,
				name: "Search regression deliverable",
			});

			permissionMocks.hasPermission.mockClear();
			permissionMocks.hasPermission.mockResolvedValue(true);
			const clientResult = await callList("Searchable Client");
			expect(clientResult.pagination.total).toBe(1);
			expect(clientResult.data[0]?.id).toBe(bookingId);
			expect(permissionMocks.hasPermission).not.toHaveBeenCalled();

			for (const query of [
				"RAK2604-0001",
				"RAK26040001",
				"Starter Collection",
				"Matrimony Coverage",
			]) {
				const result = await callList(query);
				expect(result.data[0]?.id, query).toBe(bookingId);
			}
			expect(permissionMocks.hasPermission).not.toHaveBeenCalled();

			const shootByLabel = await searchShoots(
				organizationId,
				"Infant Story",
				10,
			);
			expect(shootByLabel.map((shoot) => shoot.id)).toContain(shootId);
			const shootByCompactBookingReference = await searchShoots(
				organizationId,
				"RAK26040001",
				10,
			);
			expect(
				shootByCompactBookingReference.map((shoot) => shoot.id),
			).toContain(shootId);
			const deliverableByCompactBookingReference =
				await searchDeliverables(organizationId, "RAK26040001", 10);
			expect(
				deliverableByCompactBookingReference.map(
					(deliverable) => deliverable.id,
				),
			).toContain(deliverableId);

			const crossOrganizationLabel = await callList(
				"Other Organization Package",
			);
			expect(crossOrganizationLabel.data).toHaveLength(0);

			permissionMocks.hasPermission.mockResolvedValue(true);
			const paymentResult = await callList("12345");
			expect(paymentResult.data[0]?.id).toBe(bookingId);
			expect(permissionMocks.hasPermission).toHaveBeenCalledWith(
				context,
				"payment",
				"list",
			);

			permissionMocks.hasPermission.mockResolvedValue(false);
			const hiddenPaymentResult = await callList("12345");
			expect(hiddenPaymentResult.data).toHaveLength(0);
			const visibleBookingAmount = await callList("125000");
			expect(visibleBookingAmount.data[0]?.id).toBe(bookingId);

			await db
				.update(clients)
				.set({ deletedAt: new Date() })
				.where(eq(clients.id, clientId));
			const softDeletedClientResult = await callList("Searchable Client");
			expect(softDeletedClientResult.data).toHaveLength(0);
		} finally {
			await db
				.delete(organizations)
				.where(eq(organizations.id, organizationId));
			await db
				.delete(organizations)
				.where(eq(organizations.id, otherOrganizationId));
			process.env.DATABASE_URL = originalDatabaseUrl;
		}
	}, 15_000);
});
