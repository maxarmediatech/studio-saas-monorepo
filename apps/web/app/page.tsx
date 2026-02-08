import { resolveAppRedirectPath } from "@saas/auth/lib/redirects";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export default async function RootPage() {
	const activeOrganizationSlug = (await cookies()).get(
		"activeOrganizationSlug",
	)?.value;
	const appRedirectPath = activeOrganizationSlug
		? resolveAppRedirectPath("/app", activeOrganizationSlug)
		: "/app";

	redirect(appRedirectPath);
}
