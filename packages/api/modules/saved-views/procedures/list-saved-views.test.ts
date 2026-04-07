import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
	let capturedHandler:
		| ((options: {
				input: { entityType: string };
				context: {
					headers: Headers;
					organizationId: string;
					user: { id: string };
				};
		  }) => Promise<unknown>)
		| undefined;

	const favoritesChain = {
		from: vi.fn(),
		where: vi.fn(),
	};

	const procedureChain = {
		route: vi.fn(() => procedureChain),
		input: vi.fn(() => procedureChain),
		output: vi.fn(() => procedureChain),
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
		mockRequireSavedViewPermission: vi.fn(),
		mockFindMany: vi.fn(),
		mockSelect: vi.fn(() => favoritesChain),
		mockFrom: favoritesChain.from,
		mockWhere: favoritesChain.where,
		procedureChain,
	};
});

vi.mock("../lib/saved-view-permissions", () => ({
	requireSavedViewPermission: mocks.mockRequireSavedViewPermission,
}));

vi.mock("../../../orpc/procedures", () => ({
	studioProtectedProcedure: mocks.procedureChain,
}));

vi.mock("@repo/database", () => ({
	db: {
		query: {
			savedViews: {
				findMany: mocks.mockFindMany,
			},
		},
		select: mocks.mockSelect,
	},
	and: vi.fn((...args) => args),
	eq: vi.fn((a, b) => ({ eq: [a, b] })),
	or: vi.fn((...args) => ({ or: args })),
	savedViews: {
		organizationId: "organizationId",
		entityType: "entityType",
		isSystem: "isSystem",
		isPublic: "isPublic",
		createdBy: "createdBy",
	},
	savedViewFavorites: {
		savedViewId: "savedViewId",
		userId: "userId",
	},
}));

import "./list-saved-views";

describe("listSavedViews", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.mockFindMany.mockResolvedValue([]);
		mocks.mockFrom.mockReturnValue({ where: mocks.mockWhere });
		mocks.mockWhere.mockResolvedValue([]);
	});

	it("checks permission for the requested entity type", async () => {
		const context = {
			headers: new Headers(),
			organizationId: "org_1",
			user: { id: "user_1" },
		};

		await expect(
			mocks.handler({
				input: { entityType: "task" },
				context,
			}),
		).resolves.toEqual({ data: [] });

		expect(mocks.mockRequireSavedViewPermission).toHaveBeenCalledWith(
			context,
			"task",
			"list",
		);
	});
});
