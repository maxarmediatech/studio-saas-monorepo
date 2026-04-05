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
import {
	LEGACY_UNKNOWN_PLAN_KEY,
	PAYMENT_CATALOG_VERSION,
	resolvePurchaseIdentity,
} from "../../src/lib/catalog";
import { buildCheckoutCompletionUrl } from "../../src/lib/checkout";
import { setCustomerIdToEntity } from "../../src/lib/customer";
import type { CreateCheckoutLink, WebhookHandler } from "../../types";
import { getDodoPaymentsClient } from "./client";

export {
	cancelScheduledSubscriptionPlanChange,
	cancelSubscription,
	createCustomerPortalLink,
	getSubscriptionPlanState,
	scheduleSubscriptionPlanChange,
	setSubscriptionSeats,
} from "./subscriptions";

export const createCheckoutLink: CreateCheckoutLink = async (options) => {
	const client = getDodoPaymentsClient();
	const {
		priceKey,
		productId,
		productCollectionId,
		quantity,
		expectedPriceKeys,
		postCheckoutPath,
		customerId,
		organizationId,
		userId,
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
		expectedPriceKeys:
			expectedPriceKeys && expectedPriceKeys.length > 0
				? expectedPriceKeys
				: [priceKey],
	});

	const checkoutRequest: Parameters<
		typeof client.checkoutSessions.create
	>[0] = {
		product_cart: productCollectionId
			? []
			: [
					{
						product_id: productId ?? "",
						quantity: quantity ?? 1,
					},
				],
		...(productCollectionId
			? { product_collection_id: productCollectionId }
			: {}),
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
	};

	const response = await client.checkoutSessions.create(checkoutRequest);

	return {
		checkoutLink: response.checkout_url ?? null,
		checkoutSessionId: response.session_id ?? null,
	};
};

export async function getCheckoutSessionStatus(sessionId: string) {
	const client = getDodoPaymentsClient();
	return client.checkoutSessions.retrieve(sessionId);
}

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
		const getResolvedIdentity = ({
			type,
			productId,
			existingPurchase,
		}: {
			type: "SUBSCRIPTION" | "ONE_TIME";
			productId: string | null;
			existingPurchase?: {
				planKey: string;
				priceKey: string;
				billingInterval: string | null;
				catalogVersion: string;
				productId: string;
			} | null;
		}) =>
			resolvePurchaseIdentity({
				type,
				productId: productId ?? existingPurchase?.productId ?? "",
				planKey: existingPurchase?.planKey ?? null,
				priceKey: existingPurchase?.priceKey ?? null,
				billingInterval: existingPurchase?.billingInterval ?? null,
				catalogVersion:
					existingPurchase?.catalogVersion ?? PAYMENT_CATALOG_VERSION,
			});
		const isUniqueConstraintViolation = (error: unknown): boolean => {
			if (!error || typeof error !== "object") {
				return false;
			}

			if ("code" in error && error.code === "23505") {
				return true;
			}

			if (
				"message" in error &&
				typeof error.message === "string" &&
				error.message.includes(
					"duplicate key value violates unique constraint",
				)
			) {
				return true;
			}

			if ("cause" in error) {
				return isUniqueConstraintViolation(error.cause);
			}

			return false;
		};

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
					const identity = getResolvedIdentity({
						type: "SUBSCRIPTION",
						productId: product_id,
						existingPurchase,
					});

					if (existingPurchase) {
						await updatePurchase({
							id: existingPurchase.id,
							status: "active",
							productId: product_id ?? undefined,
							planKey: identity.planKey,
							priceKey: identity.priceKey,
							billingInterval: identity.billingInterval,
							catalogVersion: identity.catalogVersion,
						});
					} else {
						const customerId =
							customer?.customer_id || customer?.email || "";
						if (!customerId) {
							throw new Error(
								"Missing customer info in subscription.active",
							);
						}

						try {
							await createPurchase({
								subscriptionId: subscription_id,
								organizationId:
									metadata?.organization_id || null,
								userId: metadata?.user_id || null,
								customerId,
								type: "SUBSCRIPTION",
								planKey: identity.planKey,
								priceKey: identity.priceKey,
								billingInterval: identity.billingInterval,
								catalogVersion: identity.catalogVersion,
								productId: product_id || "",
								status: "active",
							});
						} catch (error) {
							if (!isUniqueConstraintViolation(error)) {
								throw error;
							}

							const concurrentPurchase =
								await getPurchaseBySubscriptionId(
									subscription_id,
								);

							if (!concurrentPurchase) {
								throw error;
							}

							await updatePurchase({
								id: concurrentPurchase.id,
								status: "active",
								productId: product_id ?? undefined,
								planKey: identity.planKey,
								priceKey: identity.priceKey,
								billingInterval: identity.billingInterval,
								catalogVersion: identity.catalogVersion,
							});
						}

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
					const identity = getResolvedIdentity({
						type: "SUBSCRIPTION",
						productId: product_id,
						existingPurchase,
					});

					if (existingPurchase) {
						await updatePurchase({
							id: existingPurchase.id,
							status: "active",
							productId: product_id ?? undefined,
							planKey: identity.planKey,
							priceKey: identity.priceKey,
							billingInterval: identity.billingInterval,
							catalogVersion: identity.catalogVersion,
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
					const identity = getResolvedIdentity({
						type: "SUBSCRIPTION",
						productId: product_id,
						existingPurchase,
					});

					if (existingPurchase) {
						await updatePurchase({
							id: existingPurchase.id,
							status: status || "active",
							productId: product_id ?? undefined,
							planKey: identity.planKey,
							priceKey: identity.priceKey,
							billingInterval: identity.billingInterval,
							catalogVersion: identity.catalogVersion,
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
					const identity = getResolvedIdentity({
						type: "SUBSCRIPTION",
						productId: product_id,
						existingPurchase,
					});

					if (existingPurchase) {
						await updatePurchase({
							id: existingPurchase.id,
							status:
								status ?? existingPurchase.status ?? "active",
							productId: product_id ?? undefined,
							planKey: identity.planKey,
							priceKey: identity.priceKey,
							billingInterval: identity.billingInterval,
							catalogVersion: identity.catalogVersion,
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

					try {
						await createPurchase({
							subscriptionId: subscription_id,
							organizationId: metadata?.organization_id || null,
							userId: metadata?.user_id || null,
							customerId,
							type: "SUBSCRIPTION",
							planKey: identity.planKey,
							priceKey: identity.priceKey,
							billingInterval: identity.billingInterval,
							catalogVersion: identity.catalogVersion,
							productId: product_id || "",
							status: status || "active",
						});
					} catch (error) {
						if (!isUniqueConstraintViolation(error)) {
							throw error;
						}

						const concurrentPurchase =
							await getPurchaseBySubscriptionId(subscription_id);

						if (!concurrentPurchase) {
							throw error;
						}

						await updatePurchase({
							id: concurrentPurchase.id,
							status:
								status ?? concurrentPurchase.status ?? "active",
							productId: product_id ?? undefined,
							planKey: identity.planKey,
							priceKey: identity.priceKey,
							billingInterval: identity.billingInterval,
							catalogVersion: identity.catalogVersion,
						});
					}

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
					const customer = getCustomer(data.customer);
					const metadata = getMetadata(data.metadata);

					// Skip if this payment is for a subscription - handled by subscription events
					if (subscription_id) {
						const existingSubscriptionPurchase =
							await getPurchaseBySubscriptionId(subscription_id);

						if (!existingSubscriptionPurchase) {
							const customerId =
								customer?.customer_id || customer?.email || "";

							if (!customerId) {
								logger.warn(
									"Received subscription payment before subscription purchase exists and without customer info",
									{ subscription_id, payment_id },
								);
							} else {
								try {
									await createPurchase({
										subscriptionId: subscription_id,
										organizationId:
											metadata?.organization_id || null,
										userId: metadata?.user_id || null,
										customerId,
										type: "SUBSCRIPTION",
										planKey: LEGACY_UNKNOWN_PLAN_KEY,
										priceKey: LEGACY_UNKNOWN_PLAN_KEY,
										billingInterval: null,
										catalogVersion: PAYMENT_CATALOG_VERSION,
										productId: "",
										paymentId: payment_id ?? undefined,
										status: "active",
									});
								} catch (error) {
									if (!isUniqueConstraintViolation(error)) {
										throw error;
									}

									const concurrentPurchase =
										await getPurchaseBySubscriptionId(
											subscription_id,
										);

									if (!concurrentPurchase) {
										throw error;
									}

									await updatePurchase({
										id: concurrentPurchase.id,
										paymentId:
											payment_id ??
											concurrentPurchase.paymentId ??
											undefined,
										status: "active",
									});
								}

								if (customer?.customer_id || customer?.email) {
									await setCustomerIdToEntity(
										customer?.customer_id ||
											customer?.email ||
											"",
										{
											organizationId:
												metadata?.organization_id,
											userId: metadata?.user_id,
										},
									);
								}

								logger.info(
									"Created placeholder subscription purchase from early payment.succeeded event",
									{ subscription_id, payment_id },
								);
							}
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
					const identity = getResolvedIdentity({
						type: "ONE_TIME",
						productId: product_id,
					});

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
						planKey: identity.planKey,
						priceKey: identity.priceKey,
						billingInterval: identity.billingInterval,
						catalogVersion: identity.catalogVersion,
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

						const identity = getResolvedIdentity({
							type: "SUBSCRIPTION",
							productId: product_id,
							existingPurchase: existingSubscriptionPurchase,
						});

						if (existingSubscriptionPurchase) {
							await updatePurchase({
								id: existingSubscriptionPurchase.id,
								paymentId:
									payment_id ??
									existingSubscriptionPurchase.paymentId ??
									undefined,
								productId: product_id ?? undefined,
								planKey: identity.planKey,
								priceKey: identity.priceKey,
								billingInterval: identity.billingInterval,
								catalogVersion: identity.catalogVersion,
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
					const identity = getResolvedIdentity({
						type: "ONE_TIME",
						productId: product_id,
						existingPurchase: existingPaymentPurchase,
					});

					if (existingPaymentPurchase) {
						await updatePurchase({
							id: existingPaymentPurchase.id,
							status: paymentStatus,
							productId: product_id ?? undefined,
							planKey: identity.planKey,
							priceKey: identity.priceKey,
							billingInterval: identity.billingInterval,
							catalogVersion: identity.catalogVersion,
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
						planKey: identity.planKey,
						priceKey: identity.priceKey,
						billingInterval: identity.billingInterval,
						catalogVersion: identity.catalogVersion,
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
