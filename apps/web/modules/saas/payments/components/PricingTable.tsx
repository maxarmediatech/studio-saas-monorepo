"use client";

import { type Config, config } from "@repo/config";
import { Button } from "@repo/ui/components/button";
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
	ShieldCheckIcon,
	StarIcon,
} from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

const plans = config.payments.plans as Config["payments"]["plans"];
type PlanConfig = Config["payments"]["plans"][string];
type PlanPrice = NonNullable<PlanConfig["prices"]>[number];
type RecurringPlanPrice = Extract<PlanPrice, { type: "recurring" }>;

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
	const t = useTranslations();
	const localeCurrency = useLocaleCurrency();
	const [loadingPlan, setLoadingPlan] = useState<PlanId | null>(null);
	const inlineCheckoutEnabled =
		process.env.NEXT_PUBLIC_DODO_INLINE_CHECKOUT !== "0";
	const { planData } = usePlanData();
	const createCheckoutLinkMutation = useMutation(
		orpc.payments.createCheckoutLink.mutationOptions(),
	);

	const onSelectPlan = async (
		planId: PlanId,
		priceKey?: string,
		expectedPriceKeys: string[] = [],
	) => {
		if (!(userId || organizationId)) {
			router.push("/auth/signup");
			return;
		}

		if (!priceKey) {
			return;
		}

		setLoadingPlan(planId);

		try {
			const { checkoutLink, checkoutSessionId, requiresHostedCheckout } =
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
				expectedPriceKeys:
					expectedPriceKeys.length > 0
						? expectedPriceKeys
						: [priceKey],
				postCheckoutPath,
				mode:
					inlineCheckoutEnabled && !requiresHostedCheckout
						? "inline"
						: "hosted",
			});

			if (inlineCheckoutEnabled && !requiresHostedCheckout) {
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

	return (
		<div className={cn("@container", className)}>
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
					const visibleRecurringPrices =
						prices?.filter(
							(item: PlanPrice): item is RecurringPlanPrice =>
								!item.hidden &&
								item.type === "recurring" &&
								item.currency === localeCurrency,
						) ?? [];
					const defaultPrice =
						visibleRecurringPrices.find(
							(item: RecurringPlanPrice) =>
								item.interval === "month",
						) ??
						visibleRecurringPrices[0] ??
						null;
					const displayPrices = visibleRecurringPrices.toSorted(
						(a, b) => {
							const intervalRank = {
								month: 0,
								year: 1,
								week: 2,
							} as const;
							return (
								intervalRank[a.interval] -
								intervalRank[b.interval]
							);
						},
					);
					const monthlyPrice = displayPrices.find(
						(item) => item.interval === "month",
					);
					const yearlyPrice = displayPrices.find(
						(item) => item.interval === "year",
					);
					const yearlySavings =
						monthlyPrice && yearlyPrice
							? Math.max(
									monthlyPrice.amount * 12 -
										yearlyPrice.amount,
									0,
								)
							: 0;

					if (!(defaultPrice || isEnterprise || comingSoon)) {
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
									) : defaultPrice ? (
										<div className="space-y-3">
											{displayPrices.length > 1 ? (
												<div className="grid gap-2 sm:grid-cols-2">
													{displayPrices.map(
														(item) => (
															<div
																key={
																	item.priceKey
																}
																className="rounded-2xl border border-foreground/8 bg-foreground/[0.03] p-4"
															>
																<div className="flex flex-col items-start gap-3">
																	<div className="font-medium text-[11px] uppercase tracking-[0.18em] text-foreground/56">
																		{item.interval ===
																		"month"
																			? t(
																					"pricing.monthlyPreview",
																				)
																			: t(
																					"pricing.yearlyPreview",
																				)}
																	</div>
																	<div className="font-medium text-2xl text-foreground lg:text-[2rem]">
																		{formatCurrency(
																			item.amount,
																			item.currency,
																		)}
																	</div>
																	{item.interval ===
																		"year" &&
																	yearlySavings >
																		0 ? (
																		<div className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-emerald-600/15 bg-emerald-600/[0.08] px-2.5 py-1 font-medium text-[11px] text-emerald-700">
																			<span className="size-1.5 rounded-full bg-emerald-600/70" />
																			{t(
																				"pricing.saveAmount",
																				{
																					amount: formatCurrency(
																						yearlySavings,
																						item.currency,
																					),
																				},
																			)}
																		</div>
																	) : null}
																</div>
															</div>
														),
													)}
												</div>
											) : (
												<strong
													className="block font-medium text-2xl lg:text-3xl"
													data-test="price-table-plan-price"
												>
													{formatCurrency(
														defaultPrice.amount,
														defaultPrice.currency,
													)}
													<span className="font-normal text-xs opacity-60">
														{" / "}
														{defaultPrice.interval ===
														"month"
															? t(
																	"pricing.month",
																	{
																		count: 1,
																	},
																)
															: t(
																	"pricing.year",
																	{
																		count: 1,
																	},
																)}
													</span>
												</strong>
											)}
										</div>
									) : null}

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
													defaultPrice?.priceKey,
													displayPrices.map(
														(item) => item.priceKey,
													),
												)
											}
											disabled={
												comingSoon ||
												!defaultPrice ||
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
													: t(
															"pricing.continueToCheckout",
														)}
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

			<div className="mt-5 flex justify-center">
				<div className="inline-flex items-center gap-2 rounded-full border border-foreground/10 bg-foreground/[0.03] px-4 py-2 text-center text-foreground/70 text-sm">
					<ShieldCheckIcon className="size-4 text-foreground/60" />
					<span>{t("pricing.moneyBackGuarantee")}</span>
				</div>
			</div>
		</div>
	);
}
