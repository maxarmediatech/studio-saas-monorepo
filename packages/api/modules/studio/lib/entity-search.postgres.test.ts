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
	it("executes relational booking search through the real list procedure", async () => {
		const originalDatabaseUrl = process.env.DATABASE_URL;
		process.env.DATABASE_URL = databaseUrl;

		const {
			bookingParticipants,
			bookings,
			clients,
			db,
			eq,
			organizations,
			receivedAmounts,
		} = await import("@repo/database");
		const { listBookings } = await import(
			"../../bookings/procedures/list-bookings"
		);

		const suffix = `${process.pid}_${Date.now()}`;
		const organizationId = `search_org_${suffix}`;
		const bookingId = `search_booking_${suffix}`;
		const clientId = `search_client_${suffix}`;

		permissionMocks.requirePermission.mockResolvedValue(undefined);
		permissionMocks.hasPermission.mockResolvedValue(true);

		try {
			await db.insert(organizations).values({
				id: organizationId,
				name: "Search regression organization",
				slug: `search-regression-${suffix}`,
			});
			await db.insert(clients).values({
				id: clientId,
				organizationId,
				name: "Searchable Client",
			});
			await db.insert(bookings).values({
				id: bookingId,
				organizationId,
				referenceNumber: `TST-${suffix}`,
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
				amount: "25000.00",
				paymentMethod: "bank_transfer",
				receivedDate: "2026-07-21",
			});

			const result = await (listBookings as any)["~orpc"].handler({
				context: {
					headers: new Headers(),
					organizationId,
				},
				input: {
					page: 1,
					limit: 10,
					search: "Searchable Client",
					sortBy: "bookingDate",
					sortDirection: "desc",
					includeDeleted: false,
				},
			});

			expect(result.pagination.total).toBe(1);
			expect(result.data).toHaveLength(1);
			expect(result.data[0]?.id).toBe(bookingId);
		} finally {
			await db
				.delete(organizations)
				.where(eq(organizations.id, organizationId));
			process.env.DATABASE_URL = originalDatabaseUrl;
		}
	});
});
