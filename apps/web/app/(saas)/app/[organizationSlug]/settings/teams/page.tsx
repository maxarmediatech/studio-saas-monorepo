import { isOrganizationAdmin } from "@repo/auth/lib/helper";
import { getActiveOrganization, getSession } from "@saas/auth/lib/server";
import { notFound } from "next/navigation";
import { TeamsPageClient } from "./teams-page-client";

type Props = {
	params: Promise<{ organizationSlug: string }>;
};

export async function generateMetadata({ params }: Props) {
	const { organizationSlug } = await params;
	const organization = await getActiveOrganization(organizationSlug);

	return {
		title: `Teams | ${organization?.name ?? "Studio"}`,
	};
}

export default async function TeamsSettingsPage({ params }: Props) {
	const session = await getSession();
	const { organizationSlug } = await params;
	const organization = await getActiveOrganization(organizationSlug);

	if (!organization) {
		return notFound();
	}

	const isAdmin = isOrganizationAdmin(organization, session?.user);
	if (!isAdmin) {
		return notFound();
	}

	return (
		<div className="px-4 pt-6 pb-8 lg:px-6">
			<TeamsPageClient organizationId={organization.id} canManage={isAdmin} />
		</div>
	);
}
