"use client";

import { type Config, config } from "@repo/config";
import { Button } from "@repo/ui/components/button";
import { CustomerPortalButton } from "@saas/settings/components/CustomerPortalButton";
import { orpc } from "@shared/lib/orpc-query-utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	CalendarClockIcon,
	CheckCircle2Icon,
	CircleAlertIcon,
	Loader2Icon,
	RefreshCcwIcon,
} from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { toast } from "sonner";

type PlanConfig = Config["payments"]["plans"][string];
type PlanPrice = NonNullable<PlanConfig["prices"]>[number];
type RecurringPlanPrice = Extract<PlanPrice, { type: "recurring" }>;

const plans = config.payments.plans as Config["payments"]["plans"];
const basicsPlan = plans["studio-basics"];
const basicsPrices =
	basicsPlan.prices?.filter(
		(price: PlanPrice): price is RecurringPlanPrice =>
			price.type === "recurring",
	) ?? [];

function getBasicsPrice(priceKey?: string | null) {
	return basicsPrices.find((price) => price.priceKey === priceKey) ?? null;
}

function formatIntervalLabel(
	interval: "month" | "year" | "one_time" | string | null | undefined,
	t: ReturnType<typeof useTranslations>,
) {
	if (interval === "year") {
		return t("settings.billing.changePlan.frequency.yearly");
	}

	return t("settings.billing.changePlan.frequency.monthly");
}

export function BillingFrequencySwitcher({
	purchaseId,
}: {
	purchaseId: string;
}) {
	const t = useTranslations();
	const format = useFormatter();
	const queryClient = useQueryClient();

	const planStateQuery = useQuery(
		orpc.payments.getSubscriptionPlanState.queryOptions({
			input: { purchaseId },
		}),
	);
	const scheduleMutation = useMutation(
		orpc.payments.scheduleSubscriptionPlanChange.mutationOptions(),
	);
	const cancelMutation = useMutation(
		orpc.payments.cancelScheduledSubscriptionPlanChange.mutationOptions(),
	);

	const currentBillingInterval = planStateQuery.data?.currentBillingInterval;
	const currentPrice = getBasicsPrice(planStateQuery.data?.currentPriceKey);
	const scheduledPrice = getBasicsPrice(
		planStateQuery.data?.scheduledChange?.priceKey,
	);
	const targetPriceKey =
		currentBillingInterval === "year"
			? "studio-basics-monthly"
			: "studio-basics-yearly";
	const targetPrice = getBasicsPrice(targetPriceKey);
	const portalCard = (
		<div className="rounded-lg border p-4">
			<div className="space-y-4">
				<div>
					<p className="font-medium text-sm">
						{t("settings.billing.changePlan.portalTitle")}
					</p>
					<p className="max-w-xl text-muted-foreground text-sm leading-6">
						{t("settings.billing.changePlan.portalHint")}
					</p>
				</div>
				<div>
					<CustomerPortalButton purchaseId={purchaseId} />
				</div>
			</div>
		</div>
	);

	const invalidatePayments = async () => {
		await queryClient.invalidateQueries({
			queryKey: orpc.payments.key(),
		});
	};

	const scheduleChange = async () => {
		try {
			const result = await scheduleMutation.mutateAsync({
				purchaseId,
				targetPriceKey,
			});

			await invalidatePayments();

			toast.success(
				t(
					"settings.billing.changePlan.frequency.notifications.scheduled",
					{
						interval: formatIntervalLabel(
							targetPrice?.interval,
							t,
						).toLowerCase(),
						date: format.dateTime(new Date(result.scheduledFor), {
							dateStyle: "medium",
						}),
					},
				),
			);
		} catch (error) {
			const message =
				error && typeof error === "object" && "message" in error
					? String(error.message)
					: t(
							"settings.billing.changePlan.frequency.notifications.error",
						);

			toast.error(message);
		}
	};

	const cancelScheduledChange = async () => {
		try {
			await cancelMutation.mutateAsync({ purchaseId });
			await invalidatePayments();
			toast.success(
				t(
					"settings.billing.changePlan.frequency.notifications.canceled",
				),
			);
		} catch {
			toast.error(
				t("settings.billing.changePlan.frequency.notifications.error"),
			);
		}
	};

	if (planStateQuery.isLoading) {
		return (
			<div className="space-y-4">
				<div className="rounded-lg border p-4">
					<p className="text-muted-foreground text-sm leading-6">
						{t("settings.billing.changePlan.frequency.loading")}
					</p>
				</div>
				{portalCard}
			</div>
		);
	}

	if (
		planStateQuery.isError ||
		!planStateQuery.data ||
		planStateQuery.data.currentPlanKey !== "studio-basics" ||
		!(
			currentBillingInterval === "month" ||
			currentBillingInterval === "year"
		)
	) {
		return portalCard;
	}

	const scheduledChange = planStateQuery.data.scheduledChange;
	const cancelAtNextBillingDate = planStateQuery.data.cancelAtNextBillingDate;
	const isBusy = scheduleMutation.isPending || cancelMutation.isPending;
	const currentLabel = formatIntervalLabel(currentBillingInterval, t);
	const targetLabel = formatIntervalLabel(targetPrice?.interval, t);

	return (
		<div className="space-y-4">
			<div className="rounded-lg border p-4">
				<div className="flex flex-wrap items-start justify-between gap-4">
					<div className="space-y-1">
						<p className="font-medium text-sm">
							{t("settings.billing.changePlan.frequency.title")}
						</p>
						<p className="max-w-xl text-muted-foreground text-sm leading-6">
							{t(
								"settings.billing.changePlan.frequency.description",
							)}
						</p>
					</div>
					<div className="inline-flex items-center gap-2 rounded-full border bg-muted/30 px-3 py-1 text-xs uppercase tracking-[0.18em] text-muted-foreground">
						<CalendarClockIcon className="size-3.5" />
						{currentLabel}
					</div>
				</div>

				<div className="mt-4 grid gap-3 sm:grid-cols-2">
					<div className="rounded-lg border bg-muted/20 p-4">
						<p className="text-muted-foreground text-xs uppercase tracking-[0.18em]">
							{t("settings.billing.changePlan.frequency.current")}
						</p>
						<p className="mt-2 font-medium text-base">
							{currentLabel}
						</p>
						{currentPrice ? (
							<p className="mt-1 font-semibold text-2xl">
								{format.number(currentPrice.amount, {
									style: "currency",
									currency: currentPrice.currency,
								})}
								<span className="ml-1 font-normal text-sm text-muted-foreground">
									/ {currentLabel.toLowerCase()}
								</span>
							</p>
						) : null}
						<p className="mt-2 text-muted-foreground text-sm leading-6">
							{t(
								"settings.billing.changePlan.frequency.renewsOn",
								{
									date: format.dateTime(
										new Date(
											planStateQuery.data.nextBillingDate,
										),
										{
											dateStyle: "medium",
										},
									),
								},
							)}
						</p>
					</div>

					<div className="rounded-lg border bg-background p-4">
						<p className="text-muted-foreground text-xs uppercase tracking-[0.18em]">
							{scheduledChange
								? t(
										"settings.billing.changePlan.frequency.scheduled",
									)
								: t(
										"settings.billing.changePlan.frequency.available",
									)}
						</p>
						<p className="mt-2 font-medium text-base">
							{scheduledChange
								? formatIntervalLabel(
										scheduledChange.billingInterval,
										t,
									)
								: targetLabel}
						</p>
						{(scheduledPrice ?? targetPrice) ? (
							<p className="mt-1 font-semibold text-2xl">
								{format.number(
									(scheduledPrice ?? targetPrice)?.amount ??
										0,
									{
										style: "currency",
										currency:
											(scheduledPrice ?? targetPrice)
												?.currency ?? "INR",
									},
								)}
								<span className="ml-1 font-normal text-sm text-muted-foreground">
									/{" "}
									{formatIntervalLabel(
										scheduledChange?.billingInterval ??
											targetPrice?.interval,
										t,
									).toLowerCase()}
								</span>
							</p>
						) : null}
						<p className="mt-2 text-muted-foreground text-sm leading-6">
							{scheduledChange
								? t(
										"settings.billing.changePlan.frequency.switchesOn",
										{
											date: format.dateTime(
												new Date(
													scheduledChange.effectiveAt,
												),
												{
													dateStyle: "medium",
												},
											),
										},
									)
								: t(
										"settings.billing.changePlan.frequency.noChargeToday",
									)}
						</p>
					</div>
				</div>

				{cancelAtNextBillingDate ? (
					<div className="mt-4 rounded-lg border border-amber-500/20 bg-amber-500/5 p-4">
						<div className="space-y-1">
							<p className="inline-flex items-center gap-2 font-medium text-sm">
								<CircleAlertIcon className="size-4 text-amber-600" />
								{t(
									"settings.billing.changePlan.frequency.cancelPendingTitle",
								)}
							</p>
							<p className="max-w-xl text-muted-foreground text-sm leading-6">
								{t(
									"settings.billing.changePlan.frequency.cancelPendingDescription",
								)}
							</p>
						</div>
					</div>
				) : scheduledChange ? (
					<div className="mt-4 rounded-lg border border-primary/15 bg-primary/5 p-4">
						<div className="flex flex-wrap items-start justify-between gap-3">
							<div className="space-y-1">
								<p className="inline-flex items-center gap-2 font-medium text-sm">
									<CheckCircle2Icon className="size-4 text-primary" />
									{t(
										"settings.billing.changePlan.frequency.scheduledTitle",
									)}
								</p>
								<p className="max-w-xl text-muted-foreground text-sm leading-6">
									{t(
										"settings.billing.changePlan.frequency.scheduledDescription",
										{
											interval: formatIntervalLabel(
												scheduledChange.billingInterval,
												t,
											).toLowerCase(),
											date: format.dateTime(
												new Date(
													scheduledChange.effectiveAt,
												),
												{
													dateStyle: "medium",
												},
											),
										},
									)}
								</p>
							</div>
							<Button
								variant="outline"
								size="sm"
								onClick={() => void cancelScheduledChange()}
								disabled={isBusy}
							>
								{cancelMutation.isPending && (
									<Loader2Icon className="mr-2 size-4 animate-spin" />
								)}
								<RefreshCcwIcon className="mr-2 size-4" />
								{t(
									"settings.billing.changePlan.frequency.cancelScheduled",
								)}
							</Button>
						</div>
					</div>
				) : (
					<div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4">
						<div className="space-y-1">
							<p className="font-medium text-sm">
								{t(
									"settings.billing.changePlan.frequency.nextStepTitle",
								)}
							</p>
							<p className="text-muted-foreground text-sm leading-6">
								{t(
									"settings.billing.changePlan.frequency.nextStepDescription",
									{
										interval: targetLabel.toLowerCase(),
										date: format.dateTime(
											new Date(
												planStateQuery.data
													.nextBillingDate,
											),
											{
												dateStyle: "medium",
											},
										),
									},
								)}
							</p>
						</div>
						<Button
							onClick={() => void scheduleChange()}
							disabled={isBusy || !targetPrice}
						>
							{scheduleMutation.isPending && (
								<Loader2Icon className="mr-2 size-4 animate-spin" />
							)}
							{targetPrice?.interval === "year"
								? t(
										"settings.billing.changePlan.frequency.switchToYearly",
									)
								: t(
										"settings.billing.changePlan.frequency.switchToMonthly",
									)}
						</Button>
					</div>
				)}
			</div>

			{portalCard}
		</div>
	);
}
