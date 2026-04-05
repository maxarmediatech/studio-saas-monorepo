"use client";

import { type Config, config } from "@repo/config";
import { Button } from "@repo/ui/components/button";
import { Tabs, TabsList, TabsTrigger } from "@repo/ui/components/tabs";
import { cn } from "@repo/ui/lib/utils";
import { usePlanData } from "@saas/payments/hooks/plan-data";
import { buildCheckoutLaunchPath } from "@saas/payments/lib/checkout-launch";
import type { PlanId } from "@saas/payments/types";
import { useLocaleCurrency } from "@shared/hooks/locale-currency";
import { useRouter } from "@shared/hooks/router";
import { orpc } from "@shared/lib/orpc-query-utils";
import { useMutation } from "@tanstack/react-query";
import {
	ArrowRightIcon,
	CheckIcon,
	Loader2Icon,
	PhoneIcon,
	StarIcon,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";

const plans = config.payments.plans as Config["payments"]["plans"];
type PlanConfig = Config["payments"]["plans"][string];
type PlanPrice = NonNullable<PlanConfig["prices"]>[number];

function formatCurrency(amount: number, currency: string) {
	return new Intl.NumberFormat("en-IN", {
		style: "currency",
		currency,
	}).format(amount);
}

export function PricingTable({
	className,
	userId,
	organizationId,
	activePlanId,
	postCheckoutPath = "/app",
	hasMonthlyIntroOffer = false,
}: {
	className?: string;
	userId?: string;
	organizationId?: string;
	activePlanId?: string;
	postCheckoutPath?: string;
	hasMonthlyIntroOffer?: boolean;
}) {
	const router = useRouter();
	const localeCurrency = useLocaleCurrency();
	const [loadingPlan, setLoadingPlan] = useState<PlanId | null>(null);
	const [interval, setInterval] = useState<"month" | "year">("month");
	const inlineCheckoutEnabled =
		process.env.NEXT_PUBLIC_DODO_INLINE_CHECKOUT !== "0";
	const { planData } = usePlanData();
	const createCheckoutLinkMutation = useMutation(
		orpc.payments.createCheckoutLink.mutationOptions(),
	);

	const onSelectPlan = async (planId: PlanId, priceKey?: string) => {
		if (!(userId || organizationId)) {
			router.push("/auth/signup");
			return;
		}

		if (!priceKey) {
			return;
		}

		setLoadingPlan(planId);

		try {
			const { checkoutLink, checkoutSessionId } =
				await createCheckoutLinkMutation.mutateAsync({
					priceKey,
					organizationId,
					postCheckoutPath,
				});

			if (!(checkoutLink && checkoutSessionId)) {
				throw new Error("Checkout session did not return a link.");
			}

			const launchPath = buildCheckoutLaunchPath({
				checkoutUrl: checkoutLink,
				checkoutSessionId,
				expectedPriceKeys: [priceKey],
				postCheckoutPath,
				mode: inlineCheckoutEnabled ? "inline" : "hosted",
			});

			if (inlineCheckoutEnabled) {
				router.push(launchPath);
				return;
			}

			window.location.href = launchPath;
		} catch (error) {
			console.error(error);

			const errorCode =
				typeof error === "object" && error !== null
					? ((error as { code?: string }).code ??
						(
							error as {
								shape?: { code?: string };
							}
						).shape?.code)
					: undefined;

			if (errorCode === "BAD_REQUEST") {
				router.refresh();
				toast.error("Plan data refreshed. Please try once again.");
				return;
			}

			toast.error("Failed to create checkout. Please try again.");
		} finally {
			setLoadingPlan(null);
		}
	};

	const filteredPlans = Object.entries(plans).filter(
		([planId]) => planId !== activePlanId,
	);

	const hasSubscriptions = filteredPlans.some(
		([_, plan]) =>
			!plan.comingSoon &&
			plan.prices?.some((price) => price.type === "recurring"),
	);

	return (
		<div className={cn("@container", className)}>
			{hasSubscriptions && (
				<div className="mb-6 flex @xl:justify-center">
					<Tabs
						value={interval}
						onValueChange={(value) =>
							setInterval(value as typeof interval)
						}
						data-test="price-table-interval-tabs"
					>
						<TabsList className="border-foreground/10">
							<TabsTrigger value="month">Monthly</TabsTrigger>
							<TabsTrigger value="year">Yearly</TabsTrigger>
						</TabsList>
					</Tabs>
				</div>
			)}

			<div
				className={cn("grid grid-cols-1 gap-4", {
					"@xl:grid-cols-2": filteredPlans.length >= 2,
					"@3xl:grid-cols-3": filteredPlans.length >= 3,
					"@4xl:grid-cols-4": filteredPlans.length >= 4,
				})}
			>
				{filteredPlans.map(([planId, plan]) => {
					const { isEnterprise, prices, recommended, comingSoon } =
						plan as PlanConfig;
					const { title, description, features } =
						planData[planId as keyof typeof planData];
					const price = prices?.find(
						(item: PlanPrice) =>
							!item.hidden &&
							(item.type === "one-time" ||
								item.interval === interval) &&
							item.currency === localeCurrency,
					);
					const showIntroOffer = Boolean(
						hasMonthlyIntroOffer &&
							price?.type === "recurring" &&
							price.priceKey === "studio-basics-monthly" &&
							price.introOfferAmount,
					);

					if (!(price || isEnterprise || comingSoon)) {
						return null;
					}

					return (
						<div
							key={planId}
							className={cn("rounded-3xl border p-6", {
								"border-2 border-primary": recommended,
								"border-foreground/10 bg-[linear-gradient(180deg,rgba(15,15,15,0.02),rgba(15,15,15,0.01))]":
									comingSoon,
							})}
							data-test="price-table-plan"
						>
							<div className="flex h-full flex-col justify-between gap-4">
								<div>
									{recommended && (
										<div className="-mt-9 flex justify-center">
											<div className="mb-2 flex h-6 w-auto items-center gap-1.5 rounded-full bg-primary px-2 py-1 font-semibold text-primary-foreground text-xs">
												<StarIcon className="size-3" />
												Recommended
											</div>
										</div>
									)}
									<div className="flex items-start justify-between gap-3">
										<div>
											<h3
												className={cn(
													"my-0 font-semibold text-2xl",
													{
														"font-bold text-primary":
															recommended,
													},
												)}
											>
												{title}
											</h3>
											{description && (
												<div className="prose mt-2 max-w-[26ch] text-foreground/58 text-sm leading-6">
													{description}
												</div>
											)}
										</div>
										{comingSoon && (
											<div className="inline-flex items-center rounded-full border border-foreground/10 bg-background px-3 py-1 font-medium text-[10px] uppercase tracking-[0.22em] text-foreground/48">
												Soon
											</div>
										)}
									</div>

									{!!features?.length && (
										<ul className="mt-6 grid list-none gap-3.5 text-[15px]">
											{features.map((feature, key) => (
												<li
													key={key}
													className="flex items-start justify-start gap-3 text-foreground/88 leading-6"
												>
													<CheckIcon className="mt-1 size-4 shrink-0 text-foreground/78" />
													<span>{feature}</span>
												</li>
											))}
										</ul>
									)}
								</div>

								<div>
									{comingSoon ? (
										<div className="pt-8">
											<div className="inline-flex items-center gap-2 font-medium text-[10px] uppercase tracking-[0.22em] text-foreground/42">
												<span className="size-1.5 rounded-full bg-foreground/24" />
												Coming soon
											</div>
										</div>
									) : price ? (
										<strong
											className="block font-medium text-2xl lg:text-3xl"
											data-test="price-table-plan-price"
										>
											{formatCurrency(
												price.amount,
												price.currency,
											)}
											{"interval" in price && (
												<span className="font-normal text-xs opacity-60">
													{" / "}
													{interval === "month"
														? "month"
														: "year"}
												</span>
											)}
											{organizationId &&
												"seatBased" in price &&
												price.seatBased && (
													<span className="font-normal text-xs opacity-60">
														{" / seat"}
													</span>
												)}
										</strong>
									) : null}

									{showIntroOffer && price && (
										<p className="mt-2 text-primary text-sm">
											{formatCurrency(
												price.introOfferAmount ?? 0,
												price.currency,
											)}{" "}
											first month, then{" "}
											{formatCurrency(
												price.amount,
												price.currency,
											)}
											/month
										</p>
									)}

									{comingSoon ? null : isEnterprise ? (
										<Button
											className="mt-4 w-full"
											variant="ghost"
											asChild
										>
											<Link href="/contact">
												<PhoneIcon className="mr-2 size-4" />
												Contact Sales
											</Link>
										</Button>
									) : (
										<Button
											className="mt-4 w-full"
											variant={
												recommended
													? "default"
													: "secondary"
											}
											onClick={() =>
												void onSelectPlan(
													planId as PlanId,
													price?.priceKey,
												)
											}
											disabled={
												comingSoon ||
												!price ||
												loadingPlan ===
													(planId as PlanId)
											}
										>
											<span className="inline-flex items-center justify-center gap-2">
												{loadingPlan ===
													(planId as PlanId) && (
													<Loader2Icon className="size-4 animate-spin" />
												)}
												{comingSoon
													? "Coming soon"
													: userId || organizationId
														? "Choose Plan"
														: "Get Started"}
											</span>
											{!comingSoon && (
												<ArrowRightIcon className="ml-2 size-4" />
											)}
										</Button>
									)}
								</div>
							</div>
						</div>
					);
				})}
			</div>
		</div>
	);
}
