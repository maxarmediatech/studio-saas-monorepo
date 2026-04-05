export type CreateCheckoutLink = (params: {
	priceKey: string;
	productId?: string;
	productCollectionId?: string;
	quantity?: number;
	expectedPriceKeys?: string[];
	email?: string;
	name?: string;
	postCheckoutPath?: string;
	customerId?: string;
	organizationId?: string;
	userId?: string;
}) => Promise<{
	checkoutLink: string | null;
	checkoutSessionId: string | null;
}>;

export type CreateCustomerPortalLink = (params: {
	subscriptionId?: string;
	customerId: string;
}) => Promise<string | null>;

export type GetSubscriptionPlanState = (id: string) => Promise<{
	subscriptionId: string;
	productId: string;
	quantity: number;
	status: string;
	cancelAtNextBillingDate: boolean;
	nextBillingDate: string;
	scheduledChange: {
		id: string;
		productId: string;
		effectiveAt: string;
		quantity: number;
	} | null;
}>;

export type ScheduleSubscriptionPlanChange = (params: {
	id: string;
	productId: string;
	quantity: number;
	effectiveAt?: "immediately" | "next_billing_date";
	prorationBillingMode?:
		| "prorated_immediately"
		| "full_immediately"
		| "difference_immediately"
		| "do_not_bill";
	onPaymentFailure?: "prevent_change" | "apply_change";
}) => Promise<void>;

export type CancelScheduledSubscriptionPlanChange = (
	id: string,
) => Promise<void>;

export type SetSubscriptionSeats = (params: {
	id: string;
	seats: number;
}) => Promise<void>;

export type CancelSubscription = (id: string) => Promise<void>;

export type WebhookHandler = (req: Request) => Promise<Response>;

export type PaymentProvider = {
	createCheckoutLink: CreateCheckoutLink;
	createCustomerPortalLink: CreateCustomerPortalLink;
	getSubscriptionPlanState: GetSubscriptionPlanState;
	scheduleSubscriptionPlanChange: ScheduleSubscriptionPlanChange;
	cancelScheduledSubscriptionPlanChange: CancelScheduledSubscriptionPlanChange;
	webhookHandler: WebhookHandler;
};
