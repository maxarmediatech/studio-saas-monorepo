import { config } from "@repo/config";
import {
	getActiveOrganizationSlug,
	resolveAppRedirectPath,
} from "@saas/auth/lib/redirects";
import { getOrganizationList, getSession } from "@saas/auth/lib/server";
import { OnboardingForm } from "@saas/onboarding/components/OnboardingForm";
import { ChoosePlanRecoveryActions } from "@saas/payments/components/ChoosePlanRecoveryActions";
import { AuthWrapper } from "@saas/shared/components/AuthWrapper";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
	title: "Onboarding",
};

type Props = {
	searchParams: Promise<{
		allowCompleted?: string | string[];
	}>;
};

function getSingleValue(
	value: string | string[] | undefined,
): string | undefined {
	if (Array.isArray(value)) {
		return value[0];
	}

	return value;
}

export default async function OnboardingPage({ searchParams }: Props) {
	const params = await searchParams;
	const allowCompletedParam = getSingleValue(params.allowCompleted);
	const allowCompletedOnboarding =
		allowCompletedParam === "1" || allowCompletedParam === "true";
	const session = await getSession();

	if (!session) {
		redirect("/auth/login");
	}

	if (
		!config.users.enableOnboarding ||
		(session.user.onboardingComplete && !allowCompletedOnboarding)
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
			headerActions={<ChoosePlanRecoveryActions showBack={false} />}
		>
			<OnboardingForm />
		</AuthWrapper>
	);
}
