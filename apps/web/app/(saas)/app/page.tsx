import { config } from "@repo/config";
import { getOrganizationList, getSession } from "@saas/auth/lib/server";
import { redirect } from "next/navigation";

export default async function AppHomePage() {
	const session = await getSession();

	if (!session) {
		redirect("/auth/login");
	}

	if (!config.organizations.enable) {
		redirect("/");
	}

	const organizations = await getOrganizationList();
	const activeOrganization =
		organizations.find(
			(org) => org.id === session.session.activeOrganizationId,
		) || organizations.at(0);

	if (!activeOrganization?.slug) {
		redirect(`/new-organization?redirectTo=${encodeURIComponent("/app")}`);
	}

	redirect(`/app/${activeOrganization.slug}/home`);
}
