import { config } from "@repo/config";
import { isAllowedDodoCheckoutUrl } from "@repo/payments/lib/checkout";
import { getSession } from "@saas/auth/lib/server";
import { isOnboardingRequired } from "@saas/onboarding/lib/access";
import { ChoosePlanRecoveryActions } from "@saas/payments/components/ChoosePlanRecoveryActions";
import { InlineCheckoutPageClient } from "@saas/payments/components/InlineCheckoutPageClient";
import { AuthWrapper } from "@saas/shared/components/AuthWrapper";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
	title: "Checkout",
};

function getSingleValue(
	value: string | string[] | undefined,
): string | undefined {
	if (Array.isArray(value)) {
		return value[0];
	}

	return value;
}

export default async function ChoosePlanCheckoutPage({
	searchParams,
}: {
	searchParams: Promise<{
		checkoutUrl?: string | string[];
		checkoutSessionId?: string | string[];
		redirectTo?: string | string[];
		prices?: string | string[];
		products?: string | string[];
	}>;
}) {
	const session = await getSession();

	if (!session) {
		redirect("/auth/login");
	}

	const params = await searchParams;
	const checkoutUrl = getSingleValue(params.checkoutUrl);
	const checkoutSessionId = getSingleValue(params.checkoutSessionId);
	const redirectTo = getSingleValue(params.redirectTo);
	const prices =
		getSingleValue(params.prices) ?? getSingleValue(params.products);
	const backHref =
		redirectTo && redirectTo !== "/app" ? redirectTo : "/choose-plan";

	if (!(checkoutUrl && isAllowedDodoCheckoutUrl(checkoutUrl))) {
		redirect("/choose-plan");
	}

	const onboardingRequired = isOnboardingRequired({
		enableOnboarding: config.users.enableOnboarding,
		onboardingComplete: Boolean(session.user.onboardingComplete),
	});

	return (
		<AuthWrapper
			contentClass="max-w-6xl p-6 lg:p-8"
			headerActions={
				<ChoosePlanRecoveryActions
					backHref="/choose-plan"
					showBack={false}
					showRestart={onboardingRequired}
				/>
			}
		>
			<InlineCheckoutPageClient
				checkoutUrl={checkoutUrl}
				checkoutSessionId={checkoutSessionId}
				postCheckoutPath={redirectTo ?? "/app"}
				expectedPriceKeys={prices ?? ""}
				backHref={backHref}
			/>
		</AuthWrapper>
	);
}
