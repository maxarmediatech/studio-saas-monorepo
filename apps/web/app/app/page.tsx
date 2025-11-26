import { config } from "@repo/config";
import { getOrganizationList, getSession } from "@saas/auth/lib/server";
import { PageHeader } from "@saas/shared/components/PageHeader";
import UserStart from "@saas/start/UserStart";
import { redirect } from "next/navigation";

export default async function AppHomePage() {
	const session = await getSession();

	if (!session) {
		redirect("/auth/login");
	}

	const organizations = await getOrganizationList();

	if (config.organizations.enable && config.organizations.requireOrganization) {
		const organization =
			organizations.find(
				(org) => org.id === session?.session.activeOrganizationId,
			) || organizations[0];

		if (!organization) {
			redirect(
				`/new-organization?redirectTo=${encodeURIComponent("/choose-plan")}`,
			);
		}

		redirect(`/app/${organization.slug}`);
	}

	return (
		<div>
			<PageHeader
				title={`Welcome, ${session?.user.name}`}
				subtitle="Here's an overview of your account"
			/>

			<UserStart />
		</div>
	);
}
