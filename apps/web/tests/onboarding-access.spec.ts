import { expect, test } from "@playwright/test";
import {
	getOnboardingRecoveryLinks,
	isOnboardingRequired,
} from "../modules/saas/onboarding/lib/access";

test.describe("onboarding access", () => {
	test("requires onboarding for incomplete users when onboarding is enabled", () => {
		expect(
			isOnboardingRequired({
				enableOnboarding: true,
				onboardingComplete: false,
			}),
		).toBe(true);
	});

	test("does not require onboarding for completed users", () => {
		expect(
			isOnboardingRequired({
				enableOnboarding: true,
				onboardingComplete: true,
			}),
		).toBe(false);
	});

	test("does not require onboarding when onboarding is disabled", () => {
		expect(
			isOnboardingRequired({
				enableOnboarding: false,
				onboardingComplete: false,
			}),
		).toBe(false);
	});

	test("does not require onboarding when disabled even if already complete", () => {
		expect(
			isOnboardingRequired({
				enableOnboarding: false,
				onboardingComplete: true,
			}),
		).toBe(false);
	});

	test("hides restart links when onboarding is not required", () => {
		expect(
			getOnboardingRecoveryLinks({
				onboardingRequired: false,
				newOrganizationPath: "/new-organization?redirectTo=%2Fapp",
			}),
		).toEqual({
			onboardingBackHref: undefined,
			restartRedirectHref: undefined,
			showRestart: false,
		});
	});

	test("returns onboarding recovery links when onboarding is required", () => {
		const path = "/new-organization?redirectTo=%2Fapp";
		expect(
			getOnboardingRecoveryLinks({
				onboardingRequired: true,
				newOrganizationPath: path,
			}),
		).toEqual({
			onboardingBackHref: `/onboarding?redirectTo=${encodeURIComponent(path)}`,
			restartRedirectHref: `/onboarding?redirectTo=${encodeURIComponent(path)}`,
			showRestart: true,
		});
	});
});
