import { cancelScheduledSubscriptionPlanChange } from "./procedures/cancel-scheduled-subscription-plan-change";
import { createCheckoutLink } from "./procedures/create-checkout-link";
import { createCustomerPortalLink } from "./procedures/create-customer-portal-link";
import { getCheckoutStatus } from "./procedures/get-checkout-status";
import { getSubscriptionPlanState } from "./procedures/get-subscription-plan-state";
import { listPurchases } from "./procedures/list-purchases";
import { scheduleSubscriptionPlanChange } from "./procedures/schedule-subscription-plan-change";

export const paymentsRouter = {
	cancelScheduledSubscriptionPlanChange,
	createCheckoutLink,
	createCustomerPortalLink,
	getCheckoutStatus,
	getSubscriptionPlanState,
	listPurchases,
	scheduleSubscriptionPlanChange,
};
