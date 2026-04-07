import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
	let capturedHandler:
		| ((options: {
				input: Record<string, unknown>;
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

	const updateChain = {
		set: vi.fn(),
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
		mockUpdate: vi.fn(() => updateChain),
		mockUpdateSet: updateChain.set,
		mockUpdateWhere: updateChain.where,
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
		update: mocks.mockUpdate,
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

import "./update-saved-view";

describe("updateSavedView", () => {
	const context = {
		headers: new Headers(),
		organizationId: "org_1",
		user: { id: "user_1" },
	};

	beforeEach(() => {
		vi.clearAllMocks();
		mocks.mockUpdateSet.mockReturnValue({ where: mocks.mockUpdateWhere });
		mocks.mockUpdateWhere.mockResolvedValue(undefined);
	});

	it("returns not found without querying when no entity types are authorized", async () => {
		mocks.mockListAuthorizedSavedViewEntityTypes.mockResolvedValue([]);

		await expect(
			mocks.handler({
				input: { id: "view_1" },
				context,
			}),
		).rejects.toMatchObject({
			code: "NOT_FOUND",
		});

		expect(mocks.mockFindFirst).not.toHaveBeenCalled();
	});

	it("scopes the lookup to authorized entity types before returning not found", async () => {
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
