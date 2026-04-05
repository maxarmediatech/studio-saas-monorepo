import { config } from "@repo/config";
import {
	sanitizeCheckoutSessionId,
	sanitizePostCheckoutPath,
} from "@repo/payments/lib/checkout";
import {
	getActiveOrganizationSlug,
	resolveAppRedirectPath,
} from "@saas/auth/lib/redirects";
import { getOrganizationList, getSession } from "@saas/auth/lib/server";
import { CheckoutCompletionPageClient } from "@saas/payments/components/CheckoutCompletionPageClient";
import { buildCheckoutCompleteRecoveryPath } from "@saas/payments/lib/checkout-complete-recovery";
import {
	PENDING_CHECKOUT_COOKIE_NAME,
	readPendingCheckoutCookie,
} from "@saas/payments/lib/pending-checkout-cookie";
import { AuthWrapper } from "@saas/shared/components/AuthWrapper";
import { orpcClient } from "@shared/lib/orpc-client";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

type Props = {
	searchParams: Promise<{
		checkoutSessionId?: string | string[];
		subscription_id?: string | string[];
		redirectTo?: string | string[];
		prices?: string | string[];
		products?: string | string[];
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

function parseExpectedPriceKeys(value: string | undefined) {
	if (!value) {
		return [];
	}

	return [
		...new Set(
			value
				.split(",")
				.map((item) => item.trim())
				.filter(Boolean),
		),
	];
}

export default async function CheckoutCompletePage({ searchParams }: Props) {
	const rawSearchParams = await searchParams;
	const cookieStore = await cookies();
	const pendingCheckout = readPendingCheckoutCookie(
		cookieStore.get(PENDING_CHECKOUT_COOKIE_NAME)?.value,
	);
	const checkoutSessionId = sanitizeCheckoutSessionId(
		getSingleValue(rawSearchParams.checkoutSessionId) ??
			pendingCheckout?.sessionId,
	);
	const subscriptionId = sanitizeCheckoutSessionId(
		getSingleValue(rawSearchParams.subscription_id),
	);
	const redirectTo = sanitizePostCheckoutPath(
		getSingleValue(rawSearchParams.redirectTo) ??
			pendingCheckout?.postCheckoutPath,
	);
	const expectedPriceKeys = (() => {
		const priceKeysFromQuery = parseExpectedPriceKeys(
			getSingleValue(rawSearchParams.prices) ??
				getSingleValue(rawSearchParams.products),
		);

		if (priceKeysFromQuery.length > 0) {
			return priceKeysFromQuery;
		}

		return pendingCheckout?.expectedPriceKeys ?? [];
	})();

	const session = await getSession();

	if (!session) {
		redirect(
			`/auth/login?redirectTo=${encodeURIComponent(
				buildCheckoutCompleteRecoveryPath({
					checkoutSessionId: checkoutSessionId ?? undefined,
					subscriptionId: subscriptionId ?? undefined,
					redirectTo,
					expectedPriceKeys,
				}),
			)}`,
		);
	}

	let organizationId: string | undefined;
	let activeOrganizationSlug: string | null = null;

	if (config.organizations.enable) {
		const organizations = await getOrganizationList();
		activeOrganizationSlug = getActiveOrganizationSlug({
			organizations,
			activeOrganizationId: session.session.activeOrganizationId,
		});
		organizationId =
			organizations.find(
				(organization) =>
					organization.id === session.session.activeOrganizationId,
			)?.id ?? organizations.at(0)?.id;
	}

	const resolvedRedirectPath = config.organizations.enable
		? resolveAppRedirectPath(redirectTo, activeOrganizationSlug)
		: redirectTo === "/app"
			? "/"
			: redirectTo;
	const fallbackHref =
		redirectTo === "/app" || redirectTo === "/app/"
			? "/choose-plan"
			: resolvedRedirectPath;
	const initialStatus = await orpcClient.payments.getCheckoutStatus({
		checkoutSessionId: checkoutSessionId ?? undefined,
		subscriptionId: subscriptionId ?? undefined,
		organizationId,
		expectedPriceKeys,
	});

	if (initialStatus.status === "active") {
		redirect(resolvedRedirectPath);
	}

	return (
		<AuthWrapper contentClass="max-w-2xl p-6 lg:p-8">
			<CheckoutCompletionPageClient
				checkoutSessionId={checkoutSessionId ?? undefined}
				subscriptionId={subscriptionId ?? undefined}
				organizationId={organizationId}
				expectedPriceKeys={expectedPriceKeys}
				initialStatus={initialStatus}
				redirectTo={resolvedRedirectPath}
				fallbackHref={fallbackHref}
			/>
		</AuthWrapper>
	);
}
