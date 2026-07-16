import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

type ProcedureHandler = (args: {
	context: Record<string, unknown>;
	input: Record<string, unknown>;
}) => Promise<unknown>;

const mocks = vi.hoisted(() => {
	const handlers = new Map<string, ProcedureHandler>();
	let routePath = "";
	const chain = {
		route: vi.fn((route: { path: string }) => {
			routePath = route.path;
			return chain;
		}),
		input: vi.fn(() => chain),
		output: vi.fn(() => chain),
		handler: vi.fn((handler: ProcedureHandler) => {
			handlers.set(routePath, handler);
			return chain;
		}),
	};
	return {
		chain,
		handlers,
		requirePermission: vi.fn(),
		requireOrganizationAdmin: vi.fn(),
		claim: vi.fn(),
		release: vi.fn(),
		adminRelease: vi.fn(),
		reassign: vi.fn(),
		decide: vi.fn(),
	};
});

vi.mock("../../../orpc/procedures", () => ({
	studioProtectedProcedure: mocks.chain,
}));

vi.mock("../../studio/lib/permissions", () => ({
	requirePermission: mocks.requirePermission,
	requireOrganizationAdmin: mocks.requireOrganizationAdmin,
}));

vi.mock("../lib/review-claim-service", () => ({
	claimSubmissionForReview: mocks.claim,
	releaseSubmissionReview: mocks.release,
	administrativelyReleaseReview: mocks.adminRelease,
	administrativelyReassignReview: mocks.reassign,
}));

vi.mock("../lib/review-decision-service", () => ({
	decideSubmissionReview: mocks.decide,
}));

const context = {
	organizationId: "org_1",
	user: {
		id: "reviewer_1",
		name: "Reviewer",
		email: "reviewer@example.test",
	},
	membership: { role: "admin" },
};

function handler(path: string): ProcedureHandler {
	const captured = mocks.handlers.get(path);
	if (!captured) {
		throw new Error(`Missing handler for ${path}`);
	}
	return captured;
}

describe("submission transition handlers", () => {
	beforeAll(async () => {
		await import("./claim-submission");
		await import("./release-submission");
		await import("./admin-release-submission");
		await import("./reassign-submission");
		await import("./review-submission");
	});

	beforeEach(() => {
		vi.clearAllMocks();
		mocks.claim.mockResolvedValue({
			id: "submission_1",
			alreadyClaimed: false,
		});
		mocks.release.mockResolvedValue({ id: "submission_1" });
		mocks.adminRelease.mockResolvedValue({ id: "submission_1" });
		mocks.reassign.mockResolvedValue({
			id: "submission_1",
			alreadyAssigned: false,
		});
		mocks.decide.mockResolvedValue({ id: "submission_1" });
	});

	it("gates claim and self-release with review claim permission", async () => {
		await handler("/submissions/{id}/claim")({
			context,
			input: { id: "submission_1" },
		});
		await handler("/submissions/{id}/release")({
			context,
			input: { id: "submission_1", reason: "Returning to queue" },
		});
		expect(mocks.requirePermission).toHaveBeenNthCalledWith(
			1,
			context,
			"review",
			"claim",
		);
		expect(mocks.requirePermission).toHaveBeenNthCalledWith(
			2,
			context,
			"review",
			"claim",
		);
		expect(mocks.claim).toHaveBeenCalledWith(context, "submission_1");
		expect(mocks.release).toHaveBeenCalledWith(context, {
			id: "submission_1",
			reason: "Returning to queue",
		});
	});

	it("gates decisions with review permission", async () => {
		const input = { id: "submission_1", decision: "approve" };
		await handler("/submissions/{id}/review")({ context, input });
		expect(mocks.requirePermission).toHaveBeenCalledWith(
			context,
			"review",
			"review",
		);
		expect(mocks.decide).toHaveBeenCalledWith(context, input);
	});

	it("reserves stale release and reassignment for organization admins", async () => {
		await handler("/submissions/{id}/admin-release")({
			context,
			input: { id: "submission_1", reason: "Reviewer unavailable" },
		});
		await handler("/submissions/{id}/reassign")({
			context,
			input: {
				id: "submission_1",
				reason: "Reviewer unavailable",
				reviewerId: "reviewer_2",
			},
		});
		expect(mocks.requireOrganizationAdmin).toHaveBeenCalledTimes(2);
		expect(mocks.adminRelease).toHaveBeenCalledOnce();
		expect(mocks.reassign).toHaveBeenCalledOnce();
	});
});
