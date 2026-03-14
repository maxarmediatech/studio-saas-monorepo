import { getActiveOrganization } from "@saas/auth/lib/server";
import { requireSettingsRouteAccess } from "@saas/settings/lib/server-access";
import { notFound } from "next/navigation";
import { MembersPageClient } from "../members/members-page-client";
import { PeoplePageClient } from "./people-page-client";

type Props = {
	params: Promise<{ organizationSlug: string }>;
	searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: Props) {
	const { organizationSlug } = await params;
	const organization = await getActiveOrganization(organizationSlug);

	return {
		title: `People | ${organization?.name ?? "Studio"}`,
	};
}

export default async function PeopleSettingsPage({
	params,
	searchParams,
}: Props) {
	const { organizationSlug } = await params;
	const resolvedSearchParams = await searchParams;
	const context = await requireSettingsRouteAccess(
		organizationSlug,
		"people",
	);

	if (!context) {
		return notFound();
	}

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
