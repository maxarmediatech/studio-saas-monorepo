"use client";
import { PricingTable } from "@saas/payments/components/PricingTable";
import { CustomerPortalButton } from "@saas/settings/components/CustomerPortalButton";
import { SettingsItem } from "@saas/shared/components/SettingsItem";
import { useTranslations } from "next-intl";

export function ChangePlan({
	organizationId,
	userId,
	activePlanId,
	activePlanPurchaseId,
	postCheckoutPath,
	hasMonthlyIntroOffer,
}: {
	organizationId?: string;
	userId?: string;
	activePlanId?: string;
	activePlanPurchaseId?: string;
	postCheckoutPath?: string;
	hasMonthlyIntroOffer?: boolean;
}) {
	const t = useTranslations();

	return (
		<SettingsItem
			title={t("settings.billing.changePlan.title")}
			description={t("settings.billing.changePlan.description")}
		>
			{activePlanId && activePlanPurchaseId ? (
				<div className="rounded-lg border p-4">
					<div className="space-y-4">
						<p className="max-w-xl text-muted-foreground text-sm leading-6">
							{t("settings.billing.changePlan.portalHint")}
						</p>
						<div>
							<CustomerPortalButton
								purchaseId={activePlanPurchaseId}
							/>
						</div>
					</div>
				</div>
			) : (
				<PricingTable
					organizationId={organizationId}
					userId={userId}
					activePlanId={activePlanId}
					postCheckoutPath={postCheckoutPath}
					hasMonthlyIntroOffer={hasMonthlyIntroOffer}
				/>
			)}
		</SettingsItem>
	);
}
