import { createPurchasesHelper } from "@repo/payments/lib/helper";
import { ActivePlan } from "@saas/payments/components/ActivePlan";
import { ChangePlan } from "@saas/payments/components/ChangePlan";
import { requireSettingsRouteAccess } from "@saas/settings/lib/server-access";
import { SettingsList } from "@saas/shared/components/SettingsList";
import { orpcClient } from "@shared/lib/orpc-client";
import { orpc } from "@shared/lib/orpc-query-utils";
import { getServerQueryClient } from "@shared/lib/server";
import { attemptAsync } from "es-toolkit";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { SettingsPageFallback } from "../_components/settings-page-fallback";

type Props = {
	params: Promise<{ organizationSlug: string }>;
};

export const metadata: Metadata = { title: "Billing" };

export default function BillingSettingsPage({ params }: Props) {
	return (
		<Suspense fallback={<SettingsPageFallback />}>
			<BillingSettingsContent params={params} />
		</Suspense>
	);
}

async function BillingSettingsContent({ params }: Props) {
	const { organizationSlug } = await params;
	const context = await requireSettingsRouteAccess(
		organizationSlug,
		"billing",
	);

	if (!context) {
		return notFound();
	}

	const [error, data] = await attemptAsync(() =>
		orpcClient.payments.listPurchases({
			organizationId: context.organization.id,
		}),
	);

	if (error) {
		throw new Error("Failed to fetch purchases");
	}

	const purchases = data?.purchases ?? [];

	const queryClient = getServerQueryClient();

	await queryClient.prefetchQuery({
		queryKey: orpc.payments.listPurchases.queryKey({
			input: { organizationId: context.organization.id },
		}),
		queryFn: () => ({ purchases }),
	});

	const { activePlan } = createPurchasesHelper(purchases);

	return (
		<SettingsList>
			{activePlan && (
				<ActivePlan organizationId={context.organization.id} />
			)}
			<ChangePlan
				organizationId={context.organization.id}
				userId={context.session.user.id}
				activePlanId={activePlan?.id}
				activePlanPurchaseId={activePlan?.purchaseId}
				postCheckoutPath={`/app/${organizationSlug}/settings/billing`}
			/>
		</SettingsList>
	);
}
