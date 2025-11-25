import {
	createPurchase,
	getPurchaseBySubscriptionId,
	updatePurchase,
} from "@repo/database";
import { logger } from "@repo/logs";
import DodoPayments from "dodopayments";
import { setCustomerIdToEntity } from "../../src/lib/customer";
import type {
	CancelSubscription,
	CreateCheckoutLink,
	CreateCustomerPortalLink,
	SetSubscriptionSeats,
	WebhookHandler,
} from "../../types";

let dodoPaymentsClient: DodoPayments | null = null;

export function getDodoPaymentsClient() {
	if (dodoPaymentsClient) {
		return dodoPaymentsClient;
	}

	const dodoPaymentsApiKey = process.env.DODO_PAYMENTS_API_KEY as string;

	if (!dodoPaymentsApiKey) {
		throw new Error("Missing env variable DODO_PAYMENTS_API_KEY");
	}

	dodoPaymentsClient = new DodoPayments({
		bearerToken: dodoPaymentsApiKey,
		environment: "test_mode",
		// environment:
		// 	process.env.NODE_ENV === "production" ? "live_mode" : "test_mode",
	});

	return dodoPaymentsClient;
}

export const createCheckoutLink: CreateCheckoutLink = async (options) => {
	const client = getDodoPaymentsClient();
	const {
		productId,
		redirectUrl,
		customerId,
		organizationId,
		userId,
		trialPeriodDays,
		seats,
		email,
		name,
	} = options;

	const metadata: Record<string, string> = {};

	if (organizationId) {
		metadata.organization_id = organizationId;
	}

	if (userId) {
		metadata.user_id = userId;
	}

	const response = await client.checkoutSessions.create({
		product_cart: [
			{
				product_id: productId,
				quantity: seats ?? 1,
			},
		],
		return_url: redirectUrl ?? "",
		customer: customerId
			? {
					customer_id: customerId,
				}
			: {
					email: email ?? "",
					name: name ?? "",
				},
		metadata,
		subscription_data: trialPeriodDays
			? {
					trial_period_days: trialPeriodDays,
				}
			: undefined,
	});

	return response.checkout_url;
};

export const createCustomerPortalLink: CreateCustomerPortalLink = async ({
	customerId,
}) => {
	const client = getDodoPaymentsClient();

	const response = await client.customers.customerPortal.create(customerId);

	return response.link;
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

export const webhookHandler: WebhookHandler = async (req) => {
	const webhookSecret = process.env.DODO_PAYMENTS_WEBHOOK_SECRET as string;

	if (!webhookSecret) {
		logger.error(
			"Missing DODO_PAYMENTS_WEBHOOK_SECRET environment variable",
		);
		return new Response("Missing webhook secret.", { status: 400 });
	}

	if (!req.body) {
		return new Response("Invalid request.", { status: 400 });
	}

	try {
		const body = await req.text();

		const webhookHeaders = {
			"webhook-id": req.headers.get("webhook-id") || "",
			"webhook-signature": req.headers.get("webhook-signature") || "",
			"webhook-timestamp": req.headers.get("webhook-timestamp") || "",
		};

		if (
			!webhookHeaders["webhook-id"] ||
			!webhookHeaders["webhook-signature"] ||
			!webhookHeaders["webhook-timestamp"]
		) {
			logger.error("Missing required webhook headers");
			return new Response("Missing webhook headers.", { status: 400 });
		}

		// Use SDK's built-in webhook verification
		const client = new DodoPayments({
			bearerToken: process.env.DODO_PAYMENTS_API_KEY as string,
			webhookKey: webhookSecret,
		});

		let event: { type: string; data: Record<string, unknown> };

		try {
			event = client.webhooks.unwrap(body, {
				headers: webhookHeaders,
			}) as unknown as typeof event;
			logger.info("Webhook signature verified", { type: event.type });
		} catch (error) {
			logger.error("Invalid webhook signature", { error });
			return new Response("Invalid webhook signature.", { status: 401 });
		}

		const { type, data } = event as {
			type: string;
			data: Record<string, unknown>;
		};

		// Helper to safely extract string values
		const getString = (val: unknown): string | null =>
			typeof val === "string" ? val : null;
		const getCustomer = (
			val: unknown,
		): { customer_id?: string; email?: string } | null =>
			val && typeof val === "object"
				? (val as Record<string, string>)
				: null;
		const getMetadata = (
			val: unknown,
		): { organization_id?: string; user_id?: string } | null =>
			val && typeof val === "object"
				? (val as Record<string, string>)
				: null;

		switch (type) {
			// Subscription becomes active (new subscription or reactivation)
			case "subscription.active": {
				const subscription_id = getString(data.subscription_id);
				const product_id = getString(data.product_id);
				const customer = getCustomer(data.customer);
				const metadata = getMetadata(data.metadata);

				if (!subscription_id) {
					logger.error(
						"Missing subscription_id in subscription.active",
					);
					break;
				}

				const existingPurchase =
					await getPurchaseBySubscriptionId(subscription_id);

				if (existingPurchase) {
					await updatePurchase({
						id: existingPurchase.id,
						status: "active",
						productId: product_id ?? undefined,
					});
				} else {
					const customerId =
						customer?.customer_id || customer?.email || "";
					if (!customerId) {
						logger.error(
							"Missing customer info in subscription.active",
						);
						break;
					}

					await createPurchase({
						subscriptionId: subscription_id,
						organizationId: metadata?.organization_id || null,
						userId: metadata?.user_id || null,
						customerId,
						type: "SUBSCRIPTION",
						productId: product_id || "",
						status: "active",
					});

					if (customer?.customer_id || customer?.email) {
						await setCustomerIdToEntity(
							customer?.customer_id || customer?.email || "",
							{
								organizationId: metadata?.organization_id,
								userId: metadata?.user_id,
							},
						);
					}
				}
				break;
			}

			// Subscription renewed (payment successful, stays active)
			case "subscription.renewed": {
				const subscription_id = getString(data.subscription_id);
				const product_id = getString(data.product_id);

				if (!subscription_id) break;

				const existingPurchase =
					await getPurchaseBySubscriptionId(subscription_id);

				if (existingPurchase) {
					await updatePurchase({
						id: existingPurchase.id,
						status: "active",
						productId: product_id ?? undefined,
					});
				}
				break;
			}

			// Subscription plan changed
			case "subscription.plan_changed": {
				const subscription_id = getString(data.subscription_id);
				const product_id = getString(data.product_id);
				const status = getString(data.status);

				if (!subscription_id) break;

				const existingPurchase =
					await getPurchaseBySubscriptionId(subscription_id);

				if (existingPurchase) {
					await updatePurchase({
						id: existingPurchase.id,
						status: status || "active",
						productId: product_id ?? undefined,
					});
				}
				break;
			}

			// Subscription on hold (e.g., payment issues)
			case "subscription.on_hold": {
				const subscription_id = getString(data.subscription_id);

				if (!subscription_id) break;

				const existingPurchase =
					await getPurchaseBySubscriptionId(subscription_id);

				if (existingPurchase) {
					await updatePurchase({
						id: existingPurchase.id,
						status: "on_hold",
					});
				}
				break;
			}

			// Subscription payment failed
			case "subscription.failed": {
				const subscription_id = getString(data.subscription_id);

				if (!subscription_id) break;

				const existingPurchase =
					await getPurchaseBySubscriptionId(subscription_id);

				if (existingPurchase) {
					await updatePurchase({
						id: existingPurchase.id,
						status: "failed",
					});
				}
				break;
			}

			// Subscription cancelled
			case "subscription.cancelled": {
				const subscription_id = getString(data.subscription_id);

				if (!subscription_id) break;

				const existingPurchase =
					await getPurchaseBySubscriptionId(subscription_id);

				if (existingPurchase) {
					await updatePurchase({
						id: existingPurchase.id,
						status: "cancelled",
					});
				}
				break;
			}

			// Subscription expired
			case "subscription.expired": {
				const subscription_id = getString(data.subscription_id);

				if (!subscription_id) break;

				const existingPurchase =
					await getPurchaseBySubscriptionId(subscription_id);

				if (existingPurchase) {
					await updatePurchase({
						id: existingPurchase.id,
						status: "expired",
					});
				}
				break;
			}

			// One-time payment succeeded
			case "payment.succeeded": {
				const payment_id = getString(data.payment_id);
				const product_id = getString(data.product_id);
				const customer = getCustomer(data.customer);
				const metadata = getMetadata(data.metadata);

				if (!payment_id) break;

				const customerId =
					customer?.customer_id || customer?.email || "";
				if (!customerId) {
					logger.error("Missing customer info in payment.succeeded");
					break;
				}

				await createPurchase({
					organizationId: metadata?.organization_id || null,
					userId: metadata?.user_id || null,
					customerId,
					type: "ONE_TIME",
					productId: product_id || "",
				});

				if (customer?.customer_id || customer?.email) {
					await setCustomerIdToEntity(
						customer?.customer_id || customer?.email || "",
						{
							organizationId: metadata?.organization_id,
							userId: metadata?.user_id,
						},
					);
				}
				break;
			}

			default:
				logger.info(`Unhandled webhook event type: ${type}`);
		}

		return new Response(null, { status: 200 });
	} catch (error) {
		logger.error("Error processing webhook", {
			error: error instanceof Error ? error.message : error,
		});

		return new Response("Webhook processing failed.", { status: 500 });
	}
};
