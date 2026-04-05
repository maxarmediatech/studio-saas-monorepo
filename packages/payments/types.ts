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

export type SetSubscriptionSeats = (params: {
	id: string;
	seats: number;
}) => Promise<void>;

export type CancelSubscription = (id: string) => Promise<void>;

export type WebhookHandler = (req: Request) => Promise<Response>;

export type PaymentProvider = {
	createCheckoutLink: CreateCheckoutLink;
	createCustomerPortalLink: CreateCustomerPortalLink;
	webhookHandler: WebhookHandler;
};
