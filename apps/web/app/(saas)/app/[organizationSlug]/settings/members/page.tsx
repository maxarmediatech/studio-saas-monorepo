import { getActiveOrganization } from "@saas/auth/lib/server";
import { OrganizationMembersBlock } from "@saas/organizations/components/OrganizationMembersBlock";
import { requireSettingsRouteAccess } from "@saas/settings/lib/server-access";
import { notFound } from "next/navigation";

type Props = {
	params: Promise<{ organizationSlug: string }>;
};

export async function generateMetadata({ params }: Props) {
	const { organizationSlug } = await params;
	const organization = await getActiveOrganization(organizationSlug);

	return {
		title: `Members | ${organization?.name ?? "Studio"}`,
	};
}

export default async function MembersSettingsPage({ params }: Props) {
	const { organizationSlug } = await params;
	const context = await requireSettingsRouteAccess(
		organizationSlug,
		"members",
	);

	if (!context) {
		return notFound();
	}

	return (
		<div className="px-4 pt-6 pb-8 lg:px-6">
			<OrganizationMembersBlock organizationId={context.organization.id} />
		</div>
	);
}
