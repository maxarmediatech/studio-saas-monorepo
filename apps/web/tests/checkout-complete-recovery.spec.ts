import { expect, test } from "@playwright/test";
import { buildCheckoutCompleteRecoveryPath } from "../modules/saas/payments/lib/checkout-complete-recovery";

test.describe("checkout complete auth recovery", () => {
	test("preserves subscription recovery params across auth bounce", () => {
		expect(
			buildCheckoutCompleteRecoveryPath({
				checkoutSessionId: "cks_test_123",
				subscriptionId: "sub_test_123",
				redirectTo: "/app",
				expectedPriceKeys: ["studio-basics-monthly"],
			}),
		).toBe(
			"/checkout/complete?checkoutSessionId=cks_test_123&subscription_id=sub_test_123&redirectTo=%2Fapp&prices=studio-basics-monthly",
		);
	});
});
