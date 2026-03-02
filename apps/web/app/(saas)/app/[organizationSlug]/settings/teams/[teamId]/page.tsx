import { getActiveOrganization } from "@saas/auth/lib/server";
import { requireSettingsRouteAccess } from "@saas/settings/lib/server-access";
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
	const { organizationSlug, teamId } = await params;
	const context = await requireSettingsRouteAccess(
		organizationSlug,
		"teams",
	);

	if (!context) {
		return notFound();
	}

	return (
		<TeamDetailPageClient
			organizationId={context.organization.id}
			organizationSlug={organizationSlug}
			teamId={teamId}
			canManage
		/>
	);
}
