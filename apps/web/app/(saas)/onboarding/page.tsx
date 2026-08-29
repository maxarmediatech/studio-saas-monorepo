import { config } from "@repo/config";
import {
	getActiveOrganizationSlug,
	resolveAppRedirectPath,
} from "@saas/auth/lib/redirects";
import { getOrganizationList, getSession } from "@saas/auth/lib/server";
import { OnboardingForm } from "@saas/onboarding/components/OnboardingForm";
import { isOnboardingRequired } from "@saas/onboarding/lib/access";
import { ChoosePlanRecoveryActions } from "@saas/payments/components/ChoosePlanRecoveryActions";
import { AuthWrapper } from "@saas/shared/components/AuthWrapper";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const instant = false;

export const metadata: Metadata = {
	title: "Onboarding",
};

export default async function OnboardingPage() {
	const session = await getSession();

	if (!session) {
		redirect("/auth/login");
	}

	if (
		!isOnboardingRequired({
			enableOnboarding: config.users.enableOnboarding,
			onboardingComplete: Boolean(session.user.onboardingComplete),
		})
	) {
		if (!config.organizations.enable) {
			redirect("/");
		}

		const organizations = await getOrganizationList();
		const activeOrganizationSlug = getActiveOrganizationSlug({
			organizations,
			activeOrganizationId: session.session.activeOrganizationId,
		});

		redirect(resolveAppRedirectPath("/app", activeOrganizationSlug));
	}

	return (
		<AuthWrapper
			headerActions={
				<ChoosePlanRecoveryActions showBack={false} showRestart />
			}
		>
			<OnboardingForm />
		</AuthWrapper>
	);
}
