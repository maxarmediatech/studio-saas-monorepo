import { config } from "@repo/config";
import { createPurchasesHelper } from "@repo/payments/lib/helper";
import { SidebarInset, SidebarProvider } from "@repo/ui/components/sidebar";
import { SessionProvider } from "@saas/auth/components/SessionProvider";
import { sessionQueryKey } from "@saas/auth/lib/api";
import { getOrganizationList, getSession } from "@saas/auth/lib/server";
import { ActiveOrganizationProvider } from "@saas/organizations/components/ActiveOrganizationProvider";
import { organizationListQueryKey } from "@saas/organizations/lib/api";
import { ConfirmationAlertProvider } from "@saas/shared/components/ConfirmationAlertProvider";
import { getServerQueryClient } from "@shared/lib/server";
import { orpcClient } from "@shared/lib/orpc-client";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { attemptAsync } from "es-toolkit";
import { redirect } from "next/navigation";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import type { PropsWithChildren } from "react";
import { DashboardSidebar } from "@/modules/dashboard/components";

export default async function ProtectedAppLayout({
	children,
}: PropsWithChildren) {
	const session = await getSession();
	const queryClient = getServerQueryClient();

	if (!session) {
		redirect("/auth/login");
	}

	if (config.users.enableOnboarding && !session.user.onboardingComplete) {
		redirect(`/onboarding?redirectTo=${encodeURIComponent("/app")}`);
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
		redirect(`/new-organization?redirectTo=${encodeURIComponent("/choose-plan")}`);
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
			redirect(`/new-organization?redirectTo=${encodeURIComponent("/choose-plan")}`);
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
			redirect("/choose-plan");
		}
	}

	await queryClient.prefetchQuery({
		queryKey: sessionQueryKey,
		queryFn: () => session,
	});

	if (config.organizations.enable) {
		await queryClient.prefetchQuery({
			queryKey: organizationListQueryKey,
			queryFn: getOrganizationList,
		});
	}

	const locale = await getLocale();
	const messages = await getMessages();

	return (
		<NextIntlClientProvider locale={locale} messages={messages}>
			<HydrationBoundary state={dehydrate(queryClient)}>
				<SessionProvider>
					<ActiveOrganizationProvider>
						<ConfirmationAlertProvider>
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
						</ConfirmationAlertProvider>
					</ActiveOrganizationProvider>
				</SessionProvider>
			</HydrationBoundary>
		</NextIntlClientProvider>
	);
}
