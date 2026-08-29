import { requireSettingsRouteAccess } from "@saas/settings/lib/server-access";
import { getOrganizationPageMetadata } from "@saas/studio/lib/organization-page-metadata";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { SettingsPageFallback } from "../_components/settings-page-fallback";
import { MembersPageClient } from "../members/members-page-client";
import { PeoplePageClient } from "./people-page-client";

type Props = {
	params: Promise<{ organizationSlug: string }>;
	searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export function generateMetadata({ params }: Props) {
	return getOrganizationPageMetadata(params, "People");
}

export default function PeopleSettingsPage({ params, searchParams }: Props) {
	return (
		<Suspense fallback={<SettingsPageFallback />}>
			<PeopleSettingsContent
				params={params}
				searchParams={searchParams}
			/>
		</Suspense>
	);
}

async function PeopleSettingsContent({ params, searchParams }: Props) {
	const { organizationSlug } = await params;
	const context = await requireSettingsRouteAccess(
		organizationSlug,
		"people",
	);

	if (!context) {
		return notFound();
	}

	const resolvedSearchParams = await searchParams;
	const activeView = Array.isArray(resolvedSearchParams.view)
		? resolvedSearchParams.view[0]
		: resolvedSearchParams.view;
	const showMembersView = activeView === "members";

	return (
		<div className="px-4 pb-8 pt-6 lg:px-6">
			{showMembersView ? (
				<MembersPageClient
					organizationId={context.organization.id}
					canManage
				/>
			) : (
				<PeoplePageClient
					organizationId={context.organization.id}
					organizationSlug={organizationSlug}
				/>
			)}
		</div>
	);
}
