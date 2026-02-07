import { config } from "@repo/config";
import { createPurchasesHelper } from "@repo/payments/lib/helper";
import { Button } from "@repo/ui/components/button";
import { getOrganizationList, getSession } from "@saas/auth/lib/server";
import { ChoosePlanRecoveryActions } from "@saas/payments/components/ChoosePlanRecoveryActions";
import { PricingTable } from "@saas/payments/components/PricingTable";
import { getPurchases } from "@saas/payments/lib/server";
import { AuthWrapper } from "@saas/shared/components/AuthWrapper";
import { attemptAsync } from "es-toolkit";
import { ArrowLeftIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
	title: "Choose Plan",
};

export default async function ChoosePlanPage() {
	const session = await getSession();

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

	if (hasPurchases && activePlan) {
		redirect("/app");
	}

	const newOrganizationPath = `/new-organization?redirectTo=${encodeURIComponent("/app")}`;

	return (
		<AuthWrapper
			contentClass="max-w-5xl"
			headerActions={
				<ChoosePlanRecoveryActions
					backHref={newOrganizationPath}
					showBack={false}
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
						Select a plan that works best for you
					</p>
				</div>
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
