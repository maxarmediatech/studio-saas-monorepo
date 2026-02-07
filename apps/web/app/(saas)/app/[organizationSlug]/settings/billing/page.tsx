import { createPurchasesHelper } from "@repo/payments/lib/helper";
import { getActiveOrganization, getSession } from "@saas/auth/lib/server";
import { ActivePlan } from "@saas/payments/components/ActivePlan";
import { ChangePlan } from "@saas/payments/components/ChangePlan";
import { SettingsList } from "@saas/shared/components/SettingsList";
import { PageContent } from "@saas/studio";
import { orpcClient } from "@shared/lib/orpc-client";
import { orpc } from "@shared/lib/orpc-query-utils";
import { getServerQueryClient } from "@shared/lib/server";
import { attemptAsync } from "es-toolkit";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

type Props = {
	params: Promise<{ organizationSlug: string }>;
};

export async function generateMetadata({ params }: Props) {
	const t = await getTranslations();
	const { organizationSlug } = await params;
	const organization = await getActiveOrganization(organizationSlug);

	return {
		title: `${t("settings.billing.title")} | ${organization?.name ?? "Studio"}`,
	};
}

export default async function BillingSettingsPage({ params }: Props) {
	const t = await getTranslations();
	const session = await getSession();
	const { organizationSlug } = await params;
	const organization = await getActiveOrganization(organizationSlug);

	if (!organization) {
		return notFound();
	}

	const [error, data] = await attemptAsync(() =>
		orpcClient.payments.listPurchases({ organizationId: organization.id }),
	);

	if (error) {
		throw new Error("Failed to fetch purchases");
	}

	const purchases = data?.purchases ?? [];

	const queryClient = getServerQueryClient();

	await queryClient.prefetchQuery({
		queryKey: orpc.payments.listPurchases.queryKey({
			input: { organizationId: organization.id },
		}),
		queryFn: () => ({ purchases }),
	});

	const { activePlan } = createPurchasesHelper(purchases);

	return (
		<PageContent title={t("settings.billing.title")}>
			<SettingsList>
				{activePlan && <ActivePlan organizationId={organization.id} />}
				<ChangePlan
					organizationId={organization.id}
					userId={session?.user.id}
					activePlanId={activePlan?.id}
				/>
			</SettingsList>
		</PageContent>
	);
}
