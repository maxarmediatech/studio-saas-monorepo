import { config } from "@repo/config";
import {
	getActiveOrganizationSlug,
	resolveAppRedirectPath,
} from "@saas/auth/lib/redirects";
import { getOrganizationList, getSession } from "@saas/auth/lib/server";
import {
	getOnboardingRecoveryLinks,
	isOnboardingRequired,
	shouldRedirectFromNewOrganizationRecovery,
} from "@saas/onboarding/lib/access";
import { CreateOrganizationForm } from "@saas/organizations/components/CreateOrganizationForm";
import { ChoosePlanRecoveryActions } from "@saas/payments/components/ChoosePlanRecoveryActions";
import { AuthWrapper } from "@saas/shared/components/AuthWrapper";
import { redirect } from "next/navigation";

export const instant = false;

type Props = {
	searchParams: Promise<{ redirectTo?: string }>;
};

export default async function NewOrganizationPage({ searchParams }: Props) {
	const rawSearchParams = await searchParams;
	const redirectTo = Array.isArray(rawSearchParams.redirectTo)
		? rawSearchParams.redirectTo[0]
		: rawSearchParams.redirectTo;
	const nextPath = redirectTo ?? "/app";
	const newOrganizationPath = `/new-organization?redirectTo=${encodeURIComponent(nextPath)}`;
	const session = await getSession();

	if (!session) {
		redirect("/auth/login");
	}

	const organizations = await getOrganizationList();
	const activeOrganization =
		organizations.find(
			(org) => org.id === session.session.activeOrganizationId,
		) || organizations.at(0);

	if (
		shouldRedirectFromNewOrganizationRecovery({
			nextPath,
			organizationsCount: organizations.length,
		})
	) {
		const activeOrganizationSlug = getActiveOrganizationSlug({
			organizations,
			activeOrganizationId: session.session.activeOrganizationId,
		});
		redirect(resolveAppRedirectPath("/app", activeOrganizationSlug));
	}

	const onboardingRequired = isOnboardingRequired({
		enableOnboarding: config.users.enableOnboarding,
		onboardingComplete: Boolean(session.user.onboardingComplete),
	});
	const { onboardingBackHref, restartRedirectHref, showRestart } =
		getOnboardingRecoveryLinks({
			onboardingRequired,
			newOrganizationPath,
		});

	if (
		!config.organizations.enable ||
		(!config.organizations.enableUsersToCreateOrganizations &&
			(!config.organizations.requireOrganization ||
				organizations.length > 0))
	) {
		const activeOrganizationSlug = getActiveOrganizationSlug({
			organizations,
			activeOrganizationId: session.session.activeOrganizationId,
		});
		redirect(resolveAppRedirectPath("/app", activeOrganizationSlug));
	}

	return (
		<AuthWrapper
			headerActions={
				<ChoosePlanRecoveryActions
					backHref={onboardingBackHref}
					restartRedirectHref={restartRedirectHref}
					showBack={false}
					showRestart={showRestart}
				/>
			}
		>
			<CreateOrganizationForm
				redirectTo={nextPath}
				backHref={onboardingBackHref}
				defaultName={activeOrganization?.name ?? ""}
				organizationToEdit={
					activeOrganization
						? {
								id: activeOrganization.id,
								slug: activeOrganization.slug,
								name: activeOrganization.name,
							}
						: undefined
				}
			/>
		</AuthWrapper>
	);
}
