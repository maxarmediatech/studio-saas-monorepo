import { expect, test } from "@playwright/test";
import {
	getOnboardingRecoveryLinks,
	isOnboardingRequired,
	shouldRedirectFromNewOrganizationRecovery,
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

	test("redirects from new-organization recovery when org exists and path is /app", () => {
		expect(
			shouldRedirectFromNewOrganizationRecovery({
				nextPath: "/app",
				organizationsCount: 1,
			}),
		).toBe(true);
	});

	test("redirects from new-organization recovery when org exists and path is /app/", () => {
		expect(
			shouldRedirectFromNewOrganizationRecovery({
				nextPath: "/app/",
				organizationsCount: 2,
			}),
		).toBe(true);
	});

	test("does not redirect from new-organization recovery when no organization exists", () => {
		expect(
			shouldRedirectFromNewOrganizationRecovery({
				nextPath: "/app",
				organizationsCount: 0,
			}),
		).toBe(false);
	});

	test("does not redirect from new-organization recovery for non-app redirect paths", () => {
		expect(
			shouldRedirectFromNewOrganizationRecovery({
				nextPath: "/settings",
				organizationsCount: 1,
			}),
		).toBe(false);
	});
});
