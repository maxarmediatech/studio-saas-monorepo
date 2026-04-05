import type {
	CancelScheduledSubscriptionPlanChange,
	CancelSubscription,
	CreateCustomerPortalLink,
	GetSubscriptionPlanState,
	ScheduleSubscriptionPlanChange,
	SetSubscriptionSeats,
} from "../../types";
import { getDodoPaymentsClient } from "./client";

export const createCustomerPortalLink: CreateCustomerPortalLink = async ({
	customerId,
}) => {
	const client = getDodoPaymentsClient();
	const response = await client.customers.customerPortal.create(customerId);
	return response.link;
};

export const getSubscriptionPlanState: GetSubscriptionPlanState = async (
	id,
) => {
	const client = getDodoPaymentsClient();
	const subscription = await client.subscriptions.retrieve(id);

	return {
		subscriptionId: subscription.subscription_id,
		productId: subscription.product_id,
		quantity: subscription.quantity,
		status: subscription.status,
		cancelAtNextBillingDate: subscription.cancel_at_next_billing_date,
		nextBillingDate: subscription.next_billing_date,
		scheduledChange: subscription.scheduled_change
			? {
					id: subscription.scheduled_change.id,
					productId: subscription.scheduled_change.product_id,
					effectiveAt: subscription.scheduled_change.effective_at,
					quantity: subscription.scheduled_change.quantity,
				}
			: null,
	};
};

export const scheduleSubscriptionPlanChange: ScheduleSubscriptionPlanChange =
	async ({
		id,
		productId,
		quantity,
		effectiveAt = "next_billing_date",
		prorationBillingMode = "do_not_bill",
		onPaymentFailure = "prevent_change",
	}) => {
		const client = getDodoPaymentsClient();

		await client.subscriptions.changePlan(id, {
			product_id: productId,
			quantity,
			proration_billing_mode: prorationBillingMode,
			effective_at: effectiveAt,
			on_payment_failure: onPaymentFailure,
		});
	};

export const cancelScheduledSubscriptionPlanChange: CancelScheduledSubscriptionPlanChange =
	async (id) => {
		const client = getDodoPaymentsClient();

		await client.subscriptions.cancelChangePlan(id);
	};

export const setSubscriptionSeats: SetSubscriptionSeats = async ({
	id,
	seats,
}) => {
	const client = getDodoPaymentsClient();
	const subscription = await client.subscriptions.retrieve(id);

	if (!subscription) {
		throw new Error("Subscription not found.");
	}

	await client.subscriptions.changePlan(id, {
		product_id: subscription.product_id,
		proration_billing_mode: "prorated_immediately",
		quantity: seats,
	});
};

export const cancelSubscription: CancelSubscription = async (id) => {
	const client = getDodoPaymentsClient();

	await client.subscriptions.update(id, {
		status: "cancelled",
	});
};
