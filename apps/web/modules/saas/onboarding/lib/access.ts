type OnboardingAccessInput = {
	enableOnboarding: boolean;
	onboardingComplete: boolean;
};

export function isOnboardingRequired({
	enableOnboarding,
	onboardingComplete,
}: OnboardingAccessInput): boolean {
	return enableOnboarding && !onboardingComplete;
}

type OnboardingRecoveryLinksInput = {
	onboardingRequired: boolean;
	newOrganizationPath: string;
};

type OnboardingRecoveryLinks = {
	onboardingBackHref?: string;
	restartRedirectHref?: string;
	showRestart: boolean;
};

export function getOnboardingRecoveryLinks({
	onboardingRequired,
	newOrganizationPath,
}: OnboardingRecoveryLinksInput): OnboardingRecoveryLinks {
	if (!onboardingRequired) {
		return {
			onboardingBackHref: undefined,
			restartRedirectHref: undefined,
			showRestart: false,
		};
	}

	const onboardingPath = `/onboarding?redirectTo=${encodeURIComponent(
		newOrganizationPath,
	)}`;

	return {
		onboardingBackHref: onboardingPath,
		restartRedirectHref: onboardingPath,
		showRestart: true,
	};
}
