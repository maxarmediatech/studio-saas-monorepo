import { config } from "@repo/config";
import { SidebarInset, SidebarProvider } from "@repo/ui/components/sidebar";
import { SessionProvider } from "@saas/auth/components/SessionProvider";
import { sessionQueryKey } from "@saas/auth/lib/api";
import { getOrganizationList, getSession } from "@saas/auth/lib/server";
import { ActiveOrganizationProvider } from "@saas/organizations/components/ActiveOrganizationProvider";
import { organizationListQueryKey } from "@saas/organizations/lib/api";
import { ConfirmationAlertProvider } from "@saas/shared/components/ConfirmationAlertProvider";
import { orpc } from "@shared/lib/orpc-query-utils";
import { getServerQueryClient } from "@shared/lib/server";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { redirect } from "next/navigation";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";
import { type PropsWithChildren, Suspense } from "react";

import { DashboardSidebar } from "@/modules/dashboard/components";

type Props = PropsWithChildren & {
	params: Promise<{ locale: string }>;
};

async function AppContent({
	children,
	locale,
}: PropsWithChildren & { locale: string }) {
	const messages = await getMessages();
	const session = await getSession();

	if (!session) {
		redirect("/auth/login");
	}

	const queryClient = getServerQueryClient();

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

	if (config.users.enableBilling) {
		await queryClient.prefetchQuery(
			orpc.payments.listPurchases.queryOptions({
				input: {},
			}),
		);
	}

	return (
		<NextIntlClientProvider locale={locale} messages={messages}>
			<HydrationBoundary state={dehydrate(queryClient)}>
				<SessionProvider>
					<ActiveOrganizationProvider>
						<ConfirmationAlertProvider>
							<SidebarProvider className="bg-sidebar">
								<DashboardSidebar />
								<SidebarInset>
									<div className="h-svh overflow-hidden lg:p-2 w-full bg-sidebar">
										<div className="lg:border lg:rounded-md overflow-hidden flex flex-col items-center justify-start h-full w-full bg-background">
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

export default async function AppLayout({ children, params }: Props) {
	const { locale } = await params;

	// Enable static rendering with cacheComponents
	setRequestLocale(locale);

	return (
		<Suspense fallback={null}>
			<AppContent locale={locale}>{children}</AppContent>
		</Suspense>
	);
}
