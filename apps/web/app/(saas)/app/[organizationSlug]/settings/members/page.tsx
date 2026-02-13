import { getActiveOrganization } from "@saas/auth/lib/server";
import { OrganizationMembersBlock } from "@saas/organizations/components/OrganizationMembersBlock";
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
	const organization = await getActiveOrganization(organizationSlug);

	if (!organization) {
		return notFound();
	}

	return <OrganizationMembersBlock organizationId={organization.id} />;
}
