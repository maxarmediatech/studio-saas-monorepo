import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
	let capturedHandler:
		| ((options: {
				input: { viewId: string };
				context: {
					headers: Headers;
					organizationId: string;
					user: { id: string };
				};
		  }) => Promise<unknown>)
		| undefined;

	const procedureChain = {
		route: vi.fn(() => procedureChain),
		input: vi.fn(() => procedureChain),
		output: vi.fn(() => procedureChain),
		handler: vi.fn((handler) => {
			capturedHandler = handler;
			return procedureChain;
		}),
	};

	const deleteChain = {
		where: vi.fn(),
	};

	return {
		get handler() {
			if (!capturedHandler) {
				throw new Error("Handler not captured");
			}

			return capturedHandler;
		},
		mockListAuthorizedSavedViewEntityTypes: vi.fn(),
		mockFindFirstSavedView: vi.fn(),
		mockFindFirstFavorite: vi.fn(),
		mockInsertValues: vi.fn(),
		mockInsert: vi.fn(() => ({ values: mocks.mockInsertValues })),
		mockDeleteWhere: deleteChain.where,
		mockDelete: vi.fn(() => deleteChain),
		mockAnd: vi.fn((...args) => args),
		mockEq: vi.fn((a, b) => ({ eq: [a, b] })),
		mockInArray: vi.fn((a, b) => ({ inArray: [a, b] })),
		procedureChain,
	};
});

vi.mock("../lib/saved-view-permissions", () => ({
	listAuthorizedSavedViewEntityTypes:
		mocks.mockListAuthorizedSavedViewEntityTypes,
}));

vi.mock("../../../orpc/procedures", () => ({
	studioProtectedProcedure: mocks.procedureChain,
}));

vi.mock("@repo/database", () => ({
	db: {
		query: {
			savedViews: {
				findFirst: mocks.mockFindFirstSavedView,
			},
			savedViewFavorites: {
				findFirst: mocks.mockFindFirstFavorite,
			},
		},
		insert: mocks.mockInsert,
		delete: mocks.mockDelete,
	},
	and: mocks.mockAnd,
	eq: mocks.mockEq,
	inArray: mocks.mockInArray,
	savedViews: {
		id: "id",
		organizationId: "organizationId",
		entityType: "entityType",
	},
	savedViewFavorites: {
		id: "favoriteId",
		savedViewId: "savedViewId",
		userId: "userId",
	},
}));

import "./toggle-favorite";

describe("toggleFavorite", () => {
	const context = {
		headers: new Headers(),
		organizationId: "org_1",
		user: { id: "user_1" },
	};

	beforeEach(() => {
		vi.clearAllMocks();
		mocks.mockInsertValues.mockResolvedValue(undefined);
		mocks.mockDeleteWhere.mockResolvedValue(undefined);
		mocks.mockFindFirstFavorite.mockResolvedValue(null);
	});

	it("scopes favorite lookup to authorized entity types", async () => {
		mocks.mockListAuthorizedSavedViewEntityTypes.mockResolvedValue([
			"task",
		]);
		mocks.mockFindFirstSavedView.mockResolvedValue(null);

		await expect(
			mocks.handler({
				input: { viewId: "view_1" },
				context,
			}),
		).rejects.toMatchObject({
			code: "NOT_FOUND",
		});

		expect(mocks.mockFindFirstSavedView).toHaveBeenCalledWith({
			where: [
				{ eq: ["id", "view_1"] },
				{ eq: ["organizationId", "org_1"] },
				{ inArray: ["entityType", ["task"]] },
			],
		});
	});
});
