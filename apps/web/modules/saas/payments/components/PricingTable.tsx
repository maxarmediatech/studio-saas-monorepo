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
	BadgePercentIcon,
	CheckIcon,
	Loader2Icon,
	PhoneIcon,
	StarIcon,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";

const plans = config.payments.plans as Config["payments"]["plans"];

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
}: {
	className?: string;
	userId?: string;
	organizationId?: string;
	activePlanId?: string;
	postCheckoutPath?: string;
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

	const buildProductCart = (
		price: NonNullable<(typeof plans)[PlanId]["prices"]>[number],
	) => {
		const items: Array<{ productId: string; quantity?: number }> = [
			{ productId: price.productId },
		];

		if (
			price.type === "recurring" &&
			price.bundledOneTimeProductId &&
			price.bundledOneTimeProductId.length > 0
		) {
			items.push({
				productId: price.bundledOneTimeProductId,
				quantity: price.bundledOneTimeQuantity ?? 1,
			});
		}

		return items;
	};

	const onSelectPlan = async (planId: PlanId, productId?: string) => {
		if (!(userId || organizationId)) {
			router.push("/auth/signup");
			return;
		}

		const plan = plans[planId];
		const price = plan.prices?.find(
			(price) => price.productId === productId,
		);

		if (!price) {
			return;
		}

		setLoadingPlan(planId);

		try {
			const productCart = buildProductCart(price);

			const { checkoutLink, checkoutSessionId } =
				await createCheckoutLinkMutation.mutateAsync({
					productCart,
					organizationId,
					postCheckoutPath,
				});

			if (!(checkoutLink && checkoutSessionId)) {
				throw new Error("Checkout session did not return a link.");
			}

			const launchPath = buildCheckoutLaunchPath({
				checkoutUrl: checkoutLink,
				checkoutSessionId,
				expectedProductIds: productCart.map((item) => item.productId),
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
		([planId]) =>
			planId !== activePlanId && (!activePlanId || planId !== "free"),
	);

	const hasSubscriptions = filteredPlans.some(([_, plan]) =>
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
				{filteredPlans
					.filter(([planId]) => planId !== activePlanId)
					.map(([planId, plan]) => {
						const { isFree, isEnterprise, prices, recommended } =
							plan;
						const { title, description, features } =
							planData[planId as keyof typeof planData];

						let price = prices?.find(
							(price) =>
								!price.hidden &&
								(price.type === "one-time" ||
									price.interval === interval) &&
								price.currency === localeCurrency,
						);

						if (isFree) {
							price = {
								amount: 0,
								currency: localeCurrency,
								interval,
								productId: "",
								type: "recurring",
							};
						}

						if (!(price || isEnterprise)) {
							return null;
						}

						return (
							<div
								key={planId}
								className={cn("rounded-3xl border p-6", {
									"border-2 border-primary": recommended,
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
											<div className="prose mt-2 text-foreground/60 text-sm">
												{description}
											</div>
										)}

										{!!features?.length && (
											<ul className="mt-4 grid list-none gap-2 text-sm">
												{features.map(
													(feature, key) => (
														<li
															key={key}
															className="flex items-center justify-start"
														>
															<CheckIcon className="mr-2 size-4 text-primary" />
															<span>
																{feature}
															</span>
														</li>
													),
												)}
											</ul>
										)}

										{price &&
											"trialPeriodDays" in price &&
											price.trialPeriodDays && (
												<div className="mt-4 flex items-center justify-start font-medium text-primary text-sm opacity-80">
													<BadgePercentIcon className="mr-2 size-4" />
													{price.trialPeriodDays} day
													free trial
												</div>
											)}
									</div>

									<div>
										{price && (
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
										)}

										{isEnterprise ? (
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
													onSelectPlan(
														planId as PlanId,
														price?.productId,
													)
												}
												disabled={
													loadingPlan ===
													(planId as PlanId)
												}
											>
												<span className="inline-flex items-center justify-center gap-2">
													{loadingPlan ===
														(planId as PlanId) && (
														<Loader2Icon className="size-4 animate-spin" />
													)}
													{userId || organizationId
														? "Choose Plan"
														: "Get Started"}
												</span>
												<ArrowRightIcon className="ml-2 size-4" />
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
