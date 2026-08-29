import { requireSettingsRouteAccess } from "@saas/settings/lib/server-access";
import { getOrganizationPageMetadata } from "@saas/studio/lib/organization-page-metadata";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { SettingsPageFallback } from "../_components/settings-page-fallback";
import { TeamsPageClient } from "./teams-page-client";

type Props = {
	params: Promise<{ organizationSlug: string }>;
};

export function generateMetadata({ params }: Props) {
	return getOrganizationPageMetadata(params, "Teams");
}

export default function TeamsSettingsPage({ params }: Props) {
	return (
		<Suspense fallback={<SettingsPageFallback />}>
			<TeamsSettingsContent params={params} />
		</Suspense>
	);
}

async function TeamsSettingsContent({ params }: Props) {
	const { organizationSlug } = await params;
	const context = await requireSettingsRouteAccess(organizationSlug, "teams");

	if (!context) {
		return notFound();
	}

	return (
		<div className="px-4 pt-6 pb-8 lg:px-6">
			<TeamsPageClient
				organizationId={context.organization.id}
				canManage
			/>
		</div>
	);
}
