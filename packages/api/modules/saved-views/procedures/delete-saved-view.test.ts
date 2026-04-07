import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
	let capturedHandler:
		| ((options: {
				input: { id: string };
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
		mockFindFirst: vi.fn(),
		mockDelete: vi.fn(() => deleteChain),
		mockDeleteWhere: deleteChain.where,
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
				findFirst: mocks.mockFindFirst,
			},
		},
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
}));

import "./delete-saved-view";

describe("deleteSavedView", () => {
	const context = {
		headers: new Headers(),
		organizationId: "org_1",
		user: { id: "user_1" },
	};

	beforeEach(() => {
		vi.clearAllMocks();
		mocks.mockDeleteWhere.mockResolvedValue(undefined);
	});

	it("scopes delete lookup to authorized entity types", async () => {
		mocks.mockListAuthorizedSavedViewEntityTypes.mockResolvedValue([
			"task",
		]);
		mocks.mockFindFirst.mockResolvedValue(null);

		await expect(
			mocks.handler({
				input: { id: "view_1" },
				context,
			}),
		).rejects.toMatchObject({
			code: "NOT_FOUND",
		});

		expect(mocks.mockFindFirst).toHaveBeenCalledWith({
			where: [
				{ eq: ["id", "view_1"] },
				{ eq: ["organizationId", "org_1"] },
				{ inArray: ["entityType", ["task"]] },
			],
		});
	});
});
