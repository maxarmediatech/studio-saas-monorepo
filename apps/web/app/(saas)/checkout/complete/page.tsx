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
		redirectTo?: string | string[];
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

function parseExpectedProductIds(value: string | undefined) {
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
	const redirectTo = sanitizePostCheckoutPath(
		getSingleValue(rawSearchParams.redirectTo) ??
			pendingCheckout?.postCheckoutPath,
	);
	const expectedProductIds = (() => {
		const productIdsFromQuery = parseExpectedProductIds(
			getSingleValue(rawSearchParams.products),
		);

		if (productIdsFromQuery.length > 0) {
			return productIdsFromQuery;
		}

		return pendingCheckout?.expectedProductIds ?? [];
	})();

	const completionSearchParams = new URLSearchParams();
	if (checkoutSessionId) {
		completionSearchParams.set("checkoutSessionId", checkoutSessionId);
	}
	completionSearchParams.set("redirectTo", redirectTo);
	if (expectedProductIds.length > 0) {
		completionSearchParams.set("products", expectedProductIds.join(","));
	}

	const session = await getSession();

	if (!session) {
		redirect(
			`/auth/login?redirectTo=${encodeURIComponent(`/checkout/complete?${completionSearchParams.toString()}`)}`,
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
		organizationId,
		expectedProductIds,
	});

	if (initialStatus.status === "active") {
		redirect(resolvedRedirectPath);
	}

	return (
		<AuthWrapper contentClass="max-w-2xl p-6 lg:p-8">
			<CheckoutCompletionPageClient
				checkoutSessionId={checkoutSessionId ?? undefined}
				organizationId={organizationId}
				expectedProductIds={expectedProductIds}
				initialStatus={initialStatus}
				redirectTo={resolvedRedirectPath}
				fallbackHref={fallbackHref}
			/>
		</AuthWrapper>
	);
}
