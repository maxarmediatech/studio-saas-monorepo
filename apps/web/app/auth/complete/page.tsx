import { config } from "@repo/config";
import {
	getActiveOrganizationSlug,
	resolveAppRedirectPath,
} from "@saas/auth/lib/redirects";
import { getOrganizationList, getSession } from "@saas/auth/lib/server";
import { sanitizeRedirectPath } from "@shared/lib/sanitize-redirect-path";
import { redirect } from "next/navigation";

export const instant = false;

type Props = {
	searchParams: Promise<{
		redirectTo?: string | string[];
	}>;
};

export default async function AuthCompletePage({ searchParams }: Props) {
	const rawSearchParams = await searchParams;
	const redirectTo = Array.isArray(rawSearchParams.redirectTo)
		? rawSearchParams.redirectTo[0]
		: rawSearchParams.redirectTo;
	const safeRedirectPath = sanitizeRedirectPath(
		redirectTo,
		config.auth.redirectAfterSignIn,
	);

	const session = await getSession();

	if (!session) {
		redirect(
			`/auth/login?redirectTo=${encodeURIComponent(safeRedirectPath)}`,
		);
	}

	if (!config.organizations.enable) {
		redirect(safeRedirectPath === "/app" ? "/" : safeRedirectPath);
	}

	const organizations = await getOrganizationList();
	const activeOrganizationSlug = getActiveOrganizationSlug({
		organizations,
		activeOrganizationId: session.session.activeOrganizationId,
	});

	redirect(resolveAppRedirectPath(safeRedirectPath, activeOrganizationSlug));
}
