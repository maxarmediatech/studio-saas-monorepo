import {
	createPurchase,
	createWebhookEvent,
	getPurchaseByPaymentId,
	getPurchaseBySubscriptionId,
	getWebhookEventByWebhookId,
	markWebhookEventFailed,
	markWebhookEventProcessed,
	updatePurchase,
} from "@repo/database";
import { assertPaymentsEnv, isEnvConfigError } from "@repo/env";
import { logger } from "@repo/logs";
import DodoPayments from "dodopayments";
import { buildCheckoutCompletionUrl } from "../../src/lib/checkout";
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

	const { DODO_PAYMENTS_API_KEY: dodoPaymentsApiKey } = assertPaymentsEnv();

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
		productCart,
		postCheckoutPath,
		customerId,
		organizationId,
		userId,
		trialPeriodDays,
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

	const returnUrl = buildCheckoutCompletionUrl({
		postCheckoutPath,
		expectedProductIds: productCart.map((item) => item.productId),
	});

	const response = await client.checkoutSessions.create({
		product_cart: productCart.map((item) => ({
			product_id: item.productId,
			quantity: item.quantity ?? 1,
		})),
		customization: {
			theme: "light",
		},
		feature_flags: {
			redirect_immediately: true,
		},
		return_url: returnUrl,
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

	return {
		checkoutLink: response.checkout_url ?? null,
		checkoutSessionId: response.session_id ?? null,
	};
};

export async function getCheckoutSessionStatus(sessionId: string) {
	const client = getDodoPaymentsClient();
	return client.checkoutSessions.retrieve(sessionId);
}

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
	try {
		const {
			DODO_PAYMENTS_WEBHOOK_SECRET: webhookSecret,
			DODO_PAYMENTS_API_KEY: apiKey,
		} = assertPaymentsEnv();

		if (!req.body) {
			return new Response("Invalid request.", { status: 400 });
		}

		const body = await req.text();

		if (!body.length) {
			logger.error("Empty webhook body");
			return new Response("Empty webhook body.", { status: 400 });
		}

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
			bearerToken: apiKey,
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

		const webhookId = webhookHeaders["webhook-id"];
		const { type, data } = event as {
			type: string;
			data: Record<string, unknown>;
		};

		// Check for duplicate webhook (idempotency via database)
		const existingEvent = await getWebhookEventByWebhookId(webhookId);
		if (existingEvent?.processed) {
			logger.info("Webhook already processed, skipping", {
				webhookId,
				eventType: type,
			});
			return new Response(null, { status: 200 });
		}

		let eventId = existingEvent?.id;

		// Log webhook event before processing (reuse existing record if it failed previously)
		if (!eventId) {
			try {
				eventId = await createWebhookEvent({
					webhookId,
					eventType: type,
					payload: body,
				});
			} catch (error) {
				const code = (error as { code?: string })?.code;
				if (code === "23505") {
					// Unique constraint violation on webhook_id; another instance logged it first
					const dedupedEvent =
						await getWebhookEventByWebhookId(webhookId);
					if (dedupedEvent) {
						eventId = dedupedEvent.id;
					} else {
						throw error;
					}
				} else {
					throw error;
				}
			}
		}

		if (!eventId) {
			logger.error("Failed to log webhook event", {
				webhookId,
				eventType: type,
			});
			return new Response("Failed to log webhook event.", {
				status: 500,
			});
		}

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

		try {
			switch (type) {
				// Subscription becomes active (new subscription or reactivation)
				case "subscription.active": {
					const subscription_id = getString(data.subscription_id);
					const product_id = getString(data.product_id);
					const customer = getCustomer(data.customer);
					const metadata = getMetadata(data.metadata);

					if (!subscription_id) {
						throw new Error(
							"Missing subscription_id in subscription.active",
						);
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
							throw new Error(
								"Missing customer info in subscription.active",
							);
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

					if (!subscription_id) {
						throw new Error(
							"Missing subscription_id in subscription.renewed",
						);
					}

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

					if (!subscription_id) {
						throw new Error(
							"Missing subscription_id in subscription.plan_changed",
						);
					}

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

				// Subscription updated (any field changed)
				case "subscription.updated": {
					const subscription_id = getString(data.subscription_id);
					const product_id = getString(data.product_id);
					const status = getString(data.status);
					const customer = getCustomer(data.customer);
					const metadata = getMetadata(data.metadata);

					if (!subscription_id) {
						throw new Error(
							"Missing subscription_id in subscription.updated",
						);
					}

					const existingPurchase =
						await getPurchaseBySubscriptionId(subscription_id);

					if (existingPurchase) {
						await updatePurchase({
							id: existingPurchase.id,
							status:
								status ?? existingPurchase.status ?? "active",
							productId: product_id ?? undefined,
						});
						break;
					}

					const customerId =
						customer?.customer_id || customer?.email || "";
					if (!customerId) {
						throw new Error(
							"Missing customer info in subscription.updated",
						);
					}

					await createPurchase({
						subscriptionId: subscription_id,
						organizationId: metadata?.organization_id || null,
						userId: metadata?.user_id || null,
						customerId,
						type: "SUBSCRIPTION",
						productId: product_id || "",
						status: status || "active",
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

				// Subscription on hold (e.g., payment issues)
				case "subscription.on_hold": {
					const subscription_id = getString(data.subscription_id);

					if (!subscription_id) {
						throw new Error(
							"Missing subscription_id in subscription.on_hold",
						);
					}

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

					if (!subscription_id) {
						throw new Error(
							"Missing subscription_id in subscription.failed",
						);
					}

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

					if (!subscription_id) {
						throw new Error(
							"Missing subscription_id in subscription.cancelled",
						);
					}

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

					if (!subscription_id) {
						throw new Error(
							"Missing subscription_id in subscription.expired",
						);
					}

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

				// One-time payment succeeded (skip if it's a subscription payment)
				case "payment.succeeded": {
					const subscription_id = getString(data.subscription_id);
					const payment_id = getString(data.payment_id);

					// Skip if this payment is for a subscription - handled by subscription events
					if (subscription_id) {
						const existingSubscriptionPurchase =
							await getPurchaseBySubscriptionId(subscription_id);

						if (!existingSubscriptionPurchase) {
							logger.warn(
								"Received subscription payment before subscription purchase exists",
								{ subscription_id, payment_id },
							);
						} else {
							await updatePurchase({
								id: existingSubscriptionPurchase.id,
								paymentId:
									payment_id ??
									existingSubscriptionPurchase.paymentId ??
									undefined,
								status: "active",
							});

							logger.info(
								"Linked subscription purchase to payment.succeeded event",
								{ subscription_id, payment_id },
							);
						}

						break;
					}

					const product_id = getString(data.product_id);
					const customer = getCustomer(data.customer);
					const metadata = getMetadata(data.metadata);

					if (!payment_id) {
						throw new Error(
							"Missing payment_id in payment.succeeded",
						);
					}

					const existingPaymentPurchase =
						await getPurchaseByPaymentId(payment_id);

					if (existingPaymentPurchase) {
						logger.info("Payment already processed, skipping", {
							payment_id,
						});
						break;
					}

					const customerId =
						customer?.customer_id || customer?.email || "";
					if (!customerId) {
						throw new Error(
							"Missing customer info in payment.succeeded",
						);
					}

					await createPurchase({
						organizationId: metadata?.organization_id || null,
						userId: metadata?.user_id || null,
						customerId,
						type: "ONE_TIME",
						productId: product_id || "",
						paymentId: payment_id,
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
					break;
				}

				case "payment.failed":
				case "payment.cancelled": {
					const paymentStatus =
						type === "payment.failed" ? "failed" : "cancelled";
					const subscription_id = getString(data.subscription_id);
					const payment_id = getString(data.payment_id);
					const product_id = getString(data.product_id);
					const customer = getCustomer(data.customer);
					const metadata = getMetadata(data.metadata);

					if (subscription_id) {
						const existingSubscriptionPurchase =
							await getPurchaseBySubscriptionId(subscription_id);

						if (existingSubscriptionPurchase) {
							await updatePurchase({
								id: existingSubscriptionPurchase.id,
								paymentId:
									payment_id ??
									existingSubscriptionPurchase.paymentId ??
									undefined,
								status:
									type === "payment.failed"
										? "on_hold"
										: paymentStatus,
							});
						}
						break;
					}

					if (!payment_id) {
						throw new Error(`Missing payment_id in ${type}`);
					}

					const existingPaymentPurchase =
						await getPurchaseByPaymentId(payment_id);

					if (existingPaymentPurchase) {
						await updatePurchase({
							id: existingPaymentPurchase.id,
							status: paymentStatus,
							productId: product_id ?? undefined,
						});
						break;
					}

					const customerId =
						customer?.customer_id || customer?.email || "";
					if (!customerId) {
						throw new Error(`Missing customer info in ${type}`);
					}

					await createPurchase({
						organizationId: metadata?.organization_id || null,
						userId: metadata?.user_id || null,
						customerId,
						type: "ONE_TIME",
						productId: product_id || "",
						paymentId: payment_id,
						status: paymentStatus,
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

			// Mark webhook as successfully processed
			await markWebhookEventProcessed(eventId);

			return new Response(null, { status: 200 });
		} catch (processingError) {
			const errorMessage =
				processingError instanceof Error
					? processingError.message
					: "Unknown error";

			logger.error("Error processing webhook event", {
				error: errorMessage,
				eventType: type,
				webhookId,
			});

			// Mark webhook as failed with error message
			await markWebhookEventFailed(eventId, errorMessage);

			return new Response(`Webhook error: ${errorMessage}`, {
				status: 400,
			});
		}
	} catch (error) {
		if (isEnvConfigError(error)) {
			logger.error("Payments environment is misconfigured", {
				code: error.code,
				keys: error.keys,
			});

			return Response.json(
				{
					message: "Payments are not configured on this deployment.",
					code: error.code,
				},
				{
					status: 503,
				},
			);
		}

		logger.error("Error processing webhook", {
			error: error instanceof Error ? error.message : error,
		});

		return new Response("Webhook processing failed.", { status: 500 });
	}
};
