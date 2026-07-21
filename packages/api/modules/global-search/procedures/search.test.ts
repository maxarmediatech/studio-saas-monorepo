import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
	let capturedHandler:
		| ((options: {
				input: {
					query: string;
					entities?: string[];
					limit: number;
				};
				context: { headers: Headers; organizationId: string };
		  }) => Promise<unknown>)
		| undefined;

	const procedureChain = {
		route: vi.fn(() => procedureChain),
		input: vi.fn(() => procedureChain),
		handler: vi.fn((handler) => {
			capturedHandler = handler;
			return procedureChain;
		}),
	};

	return {
		get handler() {
			if (!capturedHandler) {
				throw new Error("Handler not captured");
			}
			return capturedHandler;
		},
		hasPermission: vi.fn(),
		procedureChain,
		searchBookings: vi.fn(),
		searchClients: vi.fn(),
		searchCrews: vi.fn(),
		searchDeliverables: vi.fn(),
		searchExpenses: vi.fn(),
		searchInvoices: vi.fn(),
		searchShoots: vi.fn(),
		searchTasks: vi.fn(),
	};
});

vi.mock("../../../orpc/procedures", () => ({
	studioProtectedProcedure: mocks.procedureChain,
}));

vi.mock("../../studio/lib/permissions", () => ({
	hasPermission: mocks.hasPermission,
}));

vi.mock("../lib/entity-searchers", () => ({
	searchBookings: mocks.searchBookings,
	searchClients: mocks.searchClients,
	searchCrews: mocks.searchCrews,
	searchDeliverables: mocks.searchDeliverables,
	searchExpenses: mocks.searchExpenses,
	searchInvoices: mocks.searchInvoices,
	searchShoots: mocks.searchShoots,
	searchTasks: mocks.searchTasks,
}));

import "./search";

const context = {
	headers: new Headers(),
	organizationId: "org_1",
};

const searchFunctions = [
	mocks.searchBookings,
	mocks.searchClients,
	mocks.searchCrews,
	mocks.searchDeliverables,
	mocks.searchExpenses,
	mocks.searchInvoices,
	mocks.searchShoots,
	mocks.searchTasks,
];

describe("global search permissions", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.hasPermission.mockResolvedValue(true);
		for (const searchFunction of searchFunctions) {
			searchFunction.mockResolvedValue([]);
		}
	});

	it("does not request payment access for booking-only text search", async () => {
		await mocks.handler({
			context,
			input: { query: "Priya", entities: ["booking"], limit: 5 },
		});

		expect(mocks.hasPermission).toHaveBeenCalledWith(
			context,
			"booking",
			"list",
		);
		expect(mocks.hasPermission).not.toHaveBeenCalledWith(
			context,
			"payment",
			"list",
		);
		expect(mocks.searchBookings).toHaveBeenCalledWith("org_1", "Priya", 5, {
			includePaymentAmounts: false,
		});
	});

	it("requests payment access for booking-only amount search", async () => {
		await mocks.handler({
			context,
			input: { query: "₹ 12,345", entities: ["booking"], limit: 5 },
		});

		expect(mocks.hasPermission).toHaveBeenCalledWith(
			context,
			"payment",
			"list",
		);
		expect(mocks.searchBookings).toHaveBeenCalledWith(
			"org_1",
			"₹ 12,345",
			5,
			{ includePaymentAmounts: true },
		);
	});

	it("deduplicates payment-list checks when searching all entities", async () => {
		await mocks.handler({
			context,
			input: { query: "12345", limit: 5 },
		});

		const paymentListCalls = mocks.hasPermission.mock.calls.filter(
			([, resource, action]) =>
				resource === "payment" && action === "list",
		);
		expect(paymentListCalls).toHaveLength(1);
	});
});
