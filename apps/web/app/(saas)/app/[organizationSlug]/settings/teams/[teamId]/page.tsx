import { requireSettingsRouteAccess } from "@saas/settings/lib/server-access";
import { getOrganizationPageMetadata } from "@saas/studio/lib/organization-page-metadata";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { SettingsPageFallback } from "../../_components/settings-page-fallback";
import { TeamDetailPageClient } from "./team-detail-page-client";

type Props = {
	params: Promise<{ organizationSlug: string; teamId: string }>;
};

export function generateMetadata({ params }: Props) {
	return getOrganizationPageMetadata(params, "Team");
}

export default function TeamDetailPage({ params }: Props) {
	return (
		<Suspense fallback={<SettingsPageFallback />}>
			<TeamDetailContent params={params} />
		</Suspense>
	);
}

async function TeamDetailContent({ params }: Props) {
	const { organizationSlug, teamId } = await params;
	const context = await requireSettingsRouteAccess(organizationSlug, "teams");

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
