import { config } from "@repo/config";
import { createPurchasesHelper } from "@repo/payments/lib/helper";
import { Button } from "@repo/ui/components/button";
import { resolveAppRedirectPath } from "@saas/auth/lib/redirects";
import { getOrganizationList, getSession } from "@saas/auth/lib/server";
import { isOnboardingRequired } from "@saas/onboarding/lib/access";
import { ChoosePlanRecoveryActions } from "@saas/payments/components/ChoosePlanRecoveryActions";
import { PricingTable } from "@saas/payments/components/PricingTable";
import { getPurchases } from "@saas/payments/lib/server";
import { AuthWrapper } from "@saas/shared/components/AuthWrapper";
import { attemptAsync } from "es-toolkit";
import { ArrowLeftIcon } from "lucide-react";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
	title: "Choose Plan",
};

export default async function ChoosePlanPage() {
	const session = await getSession();
	let activeOrganizationSlug = (await cookies()).get(
		"activeOrganizationSlug",
	)?.value;

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
				`/new-organization?redirectTo=${encodeURIComponent("/app")}`,
			);
		}

		activeOrganizationSlug = organization.slug;
		organizationId = organization?.id;
	}

	const [error, purchases] = await attemptAsync(() =>
		getPurchases(organizationId),
	);

	if (error || !purchases) {
		throw new Error("Failed to fetch purchases");
	}

	const { activePlan } = createPurchasesHelper(purchases);
	const hasPurchases = purchases.length > 0;

	if (hasPurchases && activePlan?.hasActivePurchase) {
		const appRedirectPath = activeOrganizationSlug
			? resolveAppRedirectPath("/app", activeOrganizationSlug)
			: "/app";
		redirect(appRedirectPath);
	}

	const onboardingRequired = isOnboardingRequired({
		enableOnboarding: config.users.enableOnboarding,
		onboardingComplete: Boolean(session.user.onboardingComplete),
	});
	const newOrganizationPath = `/new-organization?redirectTo=${encodeURIComponent("/app")}`;

	return (
		<AuthWrapper
			contentClass="max-w-5xl"
			headerActions={
				<ChoosePlanRecoveryActions
					backHref={newOrganizationPath}
					showBack={false}
					showRestart={onboardingRequired}
				/>
			}
		>
			<div className="mb-4">
				<Button
					asChild
					variant="ghost"
					className="-ml-3 mb-2 h-8 px-2 text-foreground/70"
				>
					<Link href={newOrganizationPath}>
						<ArrowLeftIcon className="size-4" />
						Back
					</Link>
				</Button>

				<div className="text-center">
					<h1 className="font-bold text-2xl lg:text-3xl">
						Choose Your Plan
					</h1>
					<p className="text-muted-foreground text-sm lg:text-base">
						Pick your plan here. Monthly or yearly billing is chosen
						in checkout.
					</p>
				</div>
			</div>

			<div>
				<PricingTable
					activePlanId={hasPurchases ? activePlan?.id : undefined}
					postCheckoutPath="/app"
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
