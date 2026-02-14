import { isOrganizationAdmin } from "@repo/auth/lib/helper";
import { getActiveOrganization, getSession } from "@saas/auth/lib/server";
import { notFound } from "next/navigation";
import { TeamDetailPageClient } from "./team-detail-page-client";

type Props = {
	params: Promise<{ organizationSlug: string; teamId: string }>;
};

export async function generateMetadata({ params }: Props) {
	const { organizationSlug } = await params;
	const organization = await getActiveOrganization(organizationSlug);

	return {
		title: `Team | ${organization?.name ?? "Studio"}`,
	};
}

export default async function TeamDetailPage({ params }: Props) {
	const session = await getSession();
	const { organizationSlug, teamId } = await params;
	const organization = await getActiveOrganization(organizationSlug);

	if (!organization) {
		return notFound();
	}

	const isAdmin = isOrganizationAdmin(organization, session?.user);
	if (!isAdmin) {
		return notFound();
	}

	return (
		<TeamDetailPageClient
			organizationId={organization.id}
			organizationSlug={organizationSlug}
			teamId={teamId}
			canManage={isAdmin}
		/>
	);
}
