import { config } from "@repo/config";
import { createPurchasesHelper } from "@repo/payments/lib/helper";
import { SidebarInset, SidebarProvider } from "@repo/ui/components/sidebar";
import { getOrganizationList, getSession } from "@saas/auth/lib/server";
import { orpcClient } from "@shared/lib/orpc-client";
import { attemptAsync } from "es-toolkit";
import { redirect } from "next/navigation";
import type { PropsWithChildren } from "react";
import { DashboardSidebar } from "@/modules/dashboard/components";

type Props = PropsWithChildren & {
	params: Promise<{ locale: string }>;
};

export default async function ProtectedAppLayout({ children, params }: Props) {
	const { locale } = await params;
	const session = await getSession();

	if (!session) {
		redirect("/auth/login");
	}

	if (config.users.enableOnboarding && !session.user.onboardingComplete) {
		redirect(
			`/${locale}/onboarding?redirectTo=${encodeURIComponent(`/${locale}`)}`,
		);
	}

	const organizations = config.organizations.enable
		? await getOrganizationList()
		: [];

	const activeOrganization =
		organizations.find(
			(org) => org.id === session?.session.activeOrganizationId,
		) || organizations.at(0);

	const organizationId: string | undefined =
		config.organizations.enable && activeOrganization
			? activeOrganization.id
			: undefined;

	if (
		config.organizations.enable &&
		config.organizations.requireOrganization &&
		!organizationId
	) {
		redirect(
			`/${locale}/new-organization?redirectTo=${encodeURIComponent(`/${locale}/choose-plan`)}`,
		);
	}

	const billingEnabled =
		(config.organizations.enable && config.organizations.enableBilling) ||
		config.users.enableBilling;

	if (billingEnabled) {
		if (
			config.organizations.enable &&
			config.organizations.enableBilling &&
			!organizationId
		) {
			redirect(
				`/${locale}/new-organization?redirectTo=${encodeURIComponent(`/${locale}/choose-plan`)}`,
			);
		}

		const [error, data] = await attemptAsync(() =>
			orpcClient.payments.listPurchases({
				organizationId,
			}),
		);

		if (error) {
			throw new Error("Failed to fetch purchases");
		}

		const purchases = data?.purchases ?? [];
		const { activePlan } = createPurchasesHelper(purchases);

		const hasSelectedPlan = purchases.length > 0 && !!activePlan;

		if (!hasSelectedPlan) {
			redirect(`/${locale}/choose-plan`);
		}
	}

	return (
		<SidebarProvider className="bg-sidebar">
			<DashboardSidebar />
			<SidebarInset className="min-w-0">
				<div className="h-svh overflow-hidden lg:p-2 w-full bg-sidebar">
					<div className="lg:border lg:rounded-md overflow-hidden flex flex-col h-full w-full bg-background">
						{children}
					</div>
				</div>
			</SidebarInset>
		</SidebarProvider>
	);
}
