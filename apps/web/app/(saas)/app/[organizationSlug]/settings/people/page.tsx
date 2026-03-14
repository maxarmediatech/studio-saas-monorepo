import { getActiveOrganization } from "@saas/auth/lib/server";
import { requireSettingsRouteAccess } from "@saas/settings/lib/server-access";
import { notFound } from "next/navigation";
import { PeoplePageClient } from "./people-page-client";

type Props = {
	params: Promise<{ organizationSlug: string }>;
};

export async function generateMetadata({ params }: Props) {
	const { organizationSlug } = await params;
	const organization = await getActiveOrganization(organizationSlug);

	return {
		title: `People | ${organization?.name ?? "Studio"}`,
	};
}

export default async function PeopleSettingsPage({ params }: Props) {
	const { organizationSlug } = await params;
	const context = await requireSettingsRouteAccess(
		organizationSlug,
		"people",
	);

	if (!context) {
		return notFound();
	}

	return (
		<div className="px-4 pb-8 pt-6 lg:px-6">
			<PeoplePageClient
				organizationId={context.organization.id}
				organizationSlug={organizationSlug}
			/>
		</div>
	);
}
