import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
	let capturedHandler:
		| ((options: {
				input: Record<string, unknown>;
				context: { user: { id: string } };
		  }) => Promise<unknown>)
		| undefined;

	const procedureChain = {
		use: vi.fn(() => procedureChain),
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
		mockGetManageablePurchase: vi.fn(),
		mockGetSubscriptionPlanState: vi.fn(),
		mockCancelScheduledSubscriptionPlanChange: vi.fn(),
		mockIsEnvConfigError: vi.fn(() => false),
		mockLoggerError: vi.fn(),
		procedureChain,
	};
});

vi.mock("../../../orpc/procedures", () => ({
	protectedProcedure: mocks.procedureChain,
}));

vi.mock("../../../orpc/middleware/locale-middleware", () => ({
	localeMiddleware: {},
}));

vi.mock("../lib/get-manageable-purchase", () => ({
	getManageablePurchase: mocks.mockGetManageablePurchase,
}));

vi.mock("@repo/payments", () => ({
	cancelScheduledSubscriptionPlanChange:
		mocks.mockCancelScheduledSubscriptionPlanChange,
	getSubscriptionPlanState: mocks.mockGetSubscriptionPlanState,
}));

vi.mock("@repo/env", () => ({
	isEnvConfigError: mocks.mockIsEnvConfigError,
}));

vi.mock("@repo/logs", () => ({
	logger: {
		error: mocks.mockLoggerError,
	},
}));

import "./cancel-scheduled-subscription-plan-change";

describe("cancelScheduledSubscriptionPlanChange procedure", () => {
	beforeEach(() => {
		vi.clearAllMocks();

		mocks.mockGetManageablePurchase.mockResolvedValue({
			id: "purchase_1",
			type: "SUBSCRIPTION",
			subscriptionId: "sub_1",
		});
	});

	it("returns false when nothing is scheduled", async () => {
		mocks.mockGetSubscriptionPlanState.mockResolvedValue({
			subscriptionId: "sub_1",
			productId: "pdt_basics_month",
			quantity: 1,
			status: "active",
			cancelAtNextBillingDate: false,
			nextBillingDate: "2026-05-06T00:00:00.000Z",
			scheduledChange: null,
		});

		await expect(
			mocks.handler({
				input: { purchaseId: "purchase_1" },
				context: { user: { id: "user_1" } },
			}),
		).resolves.toEqual({ canceled: false });

		expect(
			mocks.mockCancelScheduledSubscriptionPlanChange,
		).not.toHaveBeenCalled();
	});

	it("cancels an existing scheduled change", async () => {
		mocks.mockGetSubscriptionPlanState.mockResolvedValue({
			subscriptionId: "sub_1",
			productId: "pdt_basics_month",
			quantity: 1,
			status: "active",
			cancelAtNextBillingDate: false,
			nextBillingDate: "2026-05-06T00:00:00.000Z",
			scheduledChange: {
				id: "sch_1",
				productId: "pdt_basics_year",
				effectiveAt: "2026-05-06T00:00:00.000Z",
				quantity: 1,
			},
		});

		await expect(
			mocks.handler({
				input: { purchaseId: "purchase_1" },
				context: { user: { id: "user_1" } },
			}),
		).resolves.toEqual({ canceled: true });

		expect(
			mocks.mockCancelScheduledSubscriptionPlanChange,
		).toHaveBeenCalledWith("sub_1");
	});
});
