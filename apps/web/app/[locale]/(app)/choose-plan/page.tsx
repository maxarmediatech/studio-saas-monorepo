import { config } from "@repo/config";
import { createPurchasesHelper } from "@repo/payments/lib/helper";
import { getOrganizationList, getSession } from "@saas/auth/lib/server";
import { PricingTable } from "@saas/payments/components/PricingTable";
import { getPurchases } from "@saas/payments/lib/server";
import { AuthWrapper } from "@saas/shared/components/AuthWrapper";
import { attemptAsync } from "es-toolkit";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

type Props = {
	params: Promise<{ locale: string }>;
};

export async function generateMetadata() {
	const t = await getTranslations();

	return {
		title: t("choosePlan.title"),
	};
}

export default async function ChoosePlanPage({ params }: Props) {
	const { locale } = await params;
	const t = await getTranslations();
	const session = await getSession();

	console.log({ session });

	if (!session) {
		redirect("/auth/login");
	}

	let organizationId: string | undefined;

	if (config.organizations.enable && config.organizations.enableBilling) {
		const organizationList = await getOrganizationList();
		const organization =
			organizationList.find(
				(org) => org.id === session.session.activeOrganizationId,
			) || organizationList.at(0);

		if (!organization) {
			redirect(
				`/${locale}/new-organization?redirectTo=${encodeURIComponent(`/${locale}/choose-plan`)}`,
			);
		}

		organizationId = organization?.id;
	}

	console.log({ organizationId });

	const [error, purchases] = await attemptAsync(() =>
		getPurchases(organizationId),
	);

	console.log({ purchases });

	if (error || !purchases) {
		throw new Error("Failed to fetch purchases");
	}

	const { activePlan } = createPurchasesHelper(purchases);
	const hasPurchases = purchases.length > 0;

	if (hasPurchases && activePlan) {
		redirect(`/${locale}`);
	}

	return (
		<AuthWrapper contentClass="max-w-5xl">
			<div className="mb-4 text-center">
				<h1 className="text-center font-bold text-2xl lg:text-3xl">
					{t("choosePlan.title")}
				</h1>
				<p className="text-muted-foreground text-sm lg:text-base">
					{t("choosePlan.description")}
				</p>
			</div>

			<div>
				<PricingTable
					activePlanId={hasPurchases ? activePlan?.id : undefined}
					{...(organizationId
						? {
								organizationId,
							}
						: {
								userId: session.user.id,
							})}
				/>
			</div>
		</AuthWrapper>
	);
}
