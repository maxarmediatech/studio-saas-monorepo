"use client";

import { sanitizeCheckoutSessionId } from "@repo/payments/lib/checkout";
import { Alert, AlertDescription } from "@repo/ui/components/alert";
import { Button } from "@repo/ui/components/button";
import { buildCheckoutLaunchPath } from "@saas/payments/lib/checkout-launch";
import {
	AlertCircleIcon,
	ArrowLeftIcon,
	ExternalLinkIcon,
	Loader2Icon,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";

const INLINE_CHECKOUT_CONTAINER_ID = "dodo-inline-checkout";

type DodoCheckoutEvent = {
	event_type?: string;
	data?: {
		message?: unknown;
	};
};

function getInlineModeFromCheckoutUrl(checkoutUrl: string): "test" | "live" {
	try {
		const hostname = new URL(checkoutUrl).hostname;
		if (hostname.startsWith("test.")) {
			return "test";
		}
	} catch {
		// Fall through to live mode when URL parsing fails.
	}

	return "live";
}

function getRedirectUrl(event: DodoCheckoutEvent): string | null {
	const message = event.data?.message;
	if (!message || typeof message !== "object") {
		return null;
	}

	const redirectTo = (message as { redirect_to?: unknown }).redirect_to;
	return typeof redirectTo === "string" && redirectTo.length > 0
		? redirectTo
		: null;
}

export function InlineCheckoutPageClient({
	checkoutUrl,
	checkoutSessionId,
	postCheckoutPath,
	expectedPriceKeys,
	backHref,
}: {
	checkoutUrl: string;
	checkoutSessionId?: string;
	postCheckoutPath: string;
	expectedPriceKeys: string;
	backHref: string;
}) {
	const [checkoutState, setCheckoutState] = useState<
		"idle" | "loading" | "ready" | "error"
	>("idle");
	const [errorMessage, setErrorMessage] = useState<string | null>(null);

	useEffect(() => {
		let isActive = true;
		setCheckoutState("loading");
		setErrorMessage(null);

		const mountInlineCheckout = async () => {
			try {
				const checkoutModule = await import("dodopayments-checkout");
				const { DodoPayments } = checkoutModule;

				DodoPayments.Initialize({
					mode: getInlineModeFromCheckoutUrl(checkoutUrl),
					displayType: "inline",
					onEvent: (event: DodoCheckoutEvent) => {
						if (!isActive) {
							return;
						}

						switch (event.event_type) {
							case "checkout.opened":
							case "checkout.payment_page_opened":
							case "checkout.form_ready":
								setCheckoutState("ready");
								break;
							case "checkout.error":
								setCheckoutState("error");
								setErrorMessage(
									"Inline checkout failed to load. Use full-page checkout.",
								);
								toast.error("Inline checkout failed to load.");
								break;
							case "checkout.link_expired":
								setCheckoutState("error");
								setErrorMessage(
									"Checkout session expired. Go back and choose your plan again.",
								);
								break;
							case "checkout.redirect_requested": {
								const redirectUrl = getRedirectUrl(event);
								if (redirectUrl) {
									const nextUrl = new URL(
										redirectUrl,
										window.location.origin,
									);
									const normalizedCheckoutSessionId =
										sanitizeCheckoutSessionId(
											checkoutSessionId,
										);
									if (normalizedCheckoutSessionId) {
										nextUrl.searchParams.set(
											"checkoutSessionId",
											normalizedCheckoutSessionId,
										);
									}
									window.location.href = nextUrl.toString();
								}
								break;
							}
							default:
								break;
						}
					},
				});

				DodoPayments.Checkout.open({
					checkoutUrl,
					elementId: INLINE_CHECKOUT_CONTAINER_ID,
					options: {
						manualRedirect: true,
						themeConfig: {
							light: {
								bgPrimary: "#FFFFFF",
								bgSecondary: "#F8FAFC",
								borderPrimary: "#E2E8F0",
								borderSecondary: "#CBD5E1",
								inputFocusBorder: "#94A3B8",
								textPrimary: "#0F172A",
								textSecondary: "#475569",
								textPlaceholder: "#64748B",
								textError: "#DC2626",
								textSuccess: "#16A34A",
								buttonPrimary: "#0F172A",
								buttonPrimaryHover: "#020617",
								buttonTextPrimary: "#FFFFFF",
								buttonSecondary: "#F1F5F9",
								buttonSecondaryHover: "#E2E8F0",
								buttonTextSecondary: "#0F172A",
							},
							// Keep dark mode palette intentionally light to avoid system-theme flips.
							dark: {
								bgPrimary: "#FFFFFF",
								bgSecondary: "#F8FAFC",
								borderPrimary: "#E2E8F0",
								borderSecondary: "#CBD5E1",
								inputFocusBorder: "#94A3B8",
								textPrimary: "#0F172A",
								textSecondary: "#475569",
								textPlaceholder: "#64748B",
								textError: "#DC2626",
								textSuccess: "#16A34A",
								buttonPrimary: "#0F172A",
								buttonPrimaryHover: "#020617",
								buttonTextPrimary: "#FFFFFF",
								buttonSecondary: "#F1F5F9",
								buttonSecondaryHover: "#E2E8F0",
								buttonTextSecondary: "#0F172A",
							},
							radius: "10px",
						},
					},
				});
			} catch (error) {
				console.error(error);

				if (!isActive) {
					return;
				}

				setCheckoutState("error");
				setErrorMessage(
					"Could not initialize inline checkout. Use full-page checkout.",
				);
			}
		};

		void mountInlineCheckout();

		return () => {
			isActive = false;
			void import("dodopayments-checkout")
				.then(({ DodoPayments }) => {
					DodoPayments.Checkout.close();
				})
				.catch(() => {
					// Ignore cleanup errors.
				});
		};
	}, [checkoutUrl]);

	useEffect(() => {
		if (checkoutState !== "loading") {
			return;
		}

		const container = document.getElementById(INLINE_CHECKOUT_CONTAINER_ID);
		if (!container) {
			return;
		}

		const maybeMarkReady = () => {
			setCheckoutState((previousState) =>
				previousState === "loading" ? "ready" : previousState,
			);
		};

		const bindIframeLoad = (iframe: HTMLIFrameElement) => {
			if (iframe.dataset.inlineReadyBound === "1") {
				return;
			}

			iframe.dataset.inlineReadyBound = "1";
			iframe.addEventListener("load", maybeMarkReady, { once: true });
		};

		const existingIframe = container.querySelector("iframe");
		if (existingIframe instanceof HTMLIFrameElement) {
			bindIframeLoad(existingIframe);
			// Some browsers insert a fully loaded iframe before we attach listeners.
			window.requestAnimationFrame(maybeMarkReady);
		}

		const observer = new MutationObserver(() => {
			const iframe = container.querySelector("iframe");
			if (iframe instanceof HTMLIFrameElement) {
				bindIframeLoad(iframe);
				maybeMarkReady();
			}
		});

		observer.observe(container, {
			childList: true,
			subtree: true,
		});

		// Safety net: avoid infinite loading UI if SDK events are suppressed.
		const timeoutId = window.setTimeout(maybeMarkReady, 2500);

		return () => {
			observer.disconnect();
			window.clearTimeout(timeoutId);
		};
	}, [checkoutState]);

	return (
		<div className="mx-auto w-full max-w-[920px] space-y-5">
			<div className="flex items-center justify-between gap-2">
				<Button
					asChild
					variant="ghost"
					className="-ml-3 h-8 px-2 text-foreground/70"
				>
					<Link href={backHref}>
						<ArrowLeftIcon className="size-4" />
						Back
					</Link>
				</Button>

				<Button
					variant="outline"
					onClick={() => {
						const normalizedCheckoutSessionId =
							sanitizeCheckoutSessionId(checkoutSessionId);

						if (!normalizedCheckoutSessionId) {
							window.location.replace(checkoutUrl);
							return;
						}

						window.location.replace(
							buildCheckoutLaunchPath({
								checkoutUrl,
								checkoutSessionId: normalizedCheckoutSessionId,
								expectedPriceKeys: expectedPriceKeys
									.split(",")
									.map((item) => item.trim())
									.filter(Boolean),
								postCheckoutPath,
								mode: "hosted",
							}),
						);
					}}
				>
					Open full-page checkout
					<ExternalLinkIcon className="size-4" />
				</Button>
			</div>

			<div className="space-y-1">
				<h1 className="font-bold text-2xl">Complete Your Checkout</h1>
				<p className="text-muted-foreground text-sm">
					Secure payment powered by Dodo Payments.
				</p>
			</div>

			{checkoutState !== "ready" && (
				<div className="flex items-center gap-2 rounded-md border px-3 py-2 text-muted-foreground text-sm">
					<Loader2Icon className="size-4 animate-spin" />
					Loading checkout...
				</div>
			)}

			{checkoutState === "error" && (
				<Alert variant="destructive">
					<AlertCircleIcon />
					<AlertDescription>
						{errorMessage ??
							"Checkout failed to load. Use full-page checkout."}
					</AlertDescription>
				</Alert>
			)}

			<div
				id={INLINE_CHECKOUT_CONTAINER_ID}
				className="mx-auto min-h-[760px] w-full overflow-hidden rounded-[28px] border border-foreground/10 bg-background shadow-sm [&>iframe]:mx-auto [&>iframe]:block [&>iframe]:min-h-[760px] [&>iframe]:w-full [&>iframe]:max-w-full [&>iframe]:border-0"
			/>
		</div>
	);
}
