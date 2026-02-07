import { config } from "@repo/config";
import { createPurchasesHelper } from "@repo/payments/lib/helper";
import { sessionQueryKey } from "@saas/auth/lib/api";
import {
	getActiveOrganizationSlug,
	resolveAppRedirectPath,
} from "@saas/auth/lib/redirects";
import { getOrganizationList, getSession } from "@saas/auth/lib/server";
import { ActiveOrganizationProvider } from "@saas/organizations/components/ActiveOrganizationProvider";
import { organizationListQueryKey } from "@saas/organizations/lib/api";
import { ConfirmationAlertProvider } from "@saas/shared/components/ConfirmationAlertProvider";
import { orpcClient } from "@shared/lib/orpc-client";
import { getServerQueryClient } from "@shared/lib/server";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { attemptAsync } from "es-toolkit";
import { redirect } from "next/navigation";
import type { PropsWithChildren } from "react";

export default async function ProtectedAppLayout({
	children,
}: PropsWithChildren) {
	const session = await getSession();
	const queryClient = getServerQueryClient();

	if (!session) {
		redirect("/auth/login");
	}

	const organizations = config.organizations.enable
		? await getOrganizationList()
		: [];

	const activeOrganizationSlug = getActiveOrganizationSlug({
		organizations,
		activeOrganizationId: session.session.activeOrganizationId,
	});
	const postAuthRedirectPath = resolveAppRedirectPath(
		"/app",
		activeOrganizationSlug,
	);

	if (config.users.enableOnboarding && !session.user.onboardingComplete) {
		redirect(
			`/onboarding?redirectTo=${encodeURIComponent(postAuthRedirectPath)}`,
		);
	}

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
		redirect(`/new-organization?redirectTo=${encodeURIComponent("/app")}`);
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
				`/new-organization?redirectTo=${encodeURIComponent("/app")}`,
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

		const hasSelectedPlan = Boolean(activePlan?.hasActivePurchase);

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

	return (
		<HydrationBoundary state={dehydrate(queryClient)}>
			<ActiveOrganizationProvider>
				<ConfirmationAlertProvider>
					{children}
				</ConfirmationAlertProvider>
			</ActiveOrganizationProvider>
		</HydrationBoundary>
	);
}
