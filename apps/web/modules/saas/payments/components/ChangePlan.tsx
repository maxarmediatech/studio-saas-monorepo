"use client";
import { BillingFrequencySwitcher } from "@saas/payments/components/BillingFrequencySwitcher";
import { PricingTable } from "@saas/payments/components/PricingTable";
import { SettingsItem } from "@saas/shared/components/SettingsItem";
import { useTranslations } from "next-intl";

export function ChangePlan({
	organizationId,
	userId,
	activePlanId,
	activePlanPurchaseId,
	postCheckoutPath,
}: {
	organizationId?: string;
	userId?: string;
	activePlanId?: string;
	activePlanPurchaseId?: string;
	postCheckoutPath?: string;
}) {
	const t = useTranslations();

	return (
		<SettingsItem
			title={t("settings.billing.changePlan.title")}
			description={t("settings.billing.changePlan.description")}
		>
			{activePlanId && activePlanPurchaseId ? (
				<BillingFrequencySwitcher purchaseId={activePlanPurchaseId} />
			) : (
				<PricingTable
					organizationId={organizationId}
					userId={userId}
					activePlanId={activePlanId}
					postCheckoutPath={postCheckoutPath}
				/>
			)}
		</SettingsItem>
	);
}
