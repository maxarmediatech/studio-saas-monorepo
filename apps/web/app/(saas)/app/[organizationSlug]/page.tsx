import { getActiveOrganization } from "@saas/auth/lib/server";
import OrganizationStart from "@saas/organizations/components/OrganizationStart";
import { PageHeader } from "@saas/shared/components/PageHeader";
import { notFound } from "next/navigation";

type Props = {
	params: Promise<{ organizationSlug: string }>;
};

export async function generateMetadata({ params }: Props) {
	const { organizationSlug } = await params;

	const activeOrganization = await getActiveOrganization(organizationSlug);

	return {
		title: activeOrganization?.name,
	};
}

export default async function OrganizationPage({ params }: Props) {
	const { organizationSlug } = await params;

	const activeOrganization = await getActiveOrganization(organizationSlug);

	if (!activeOrganization) {
		return notFound();
	}

	return (
		<div>
			<PageHeader
				title={activeOrganization.name}
				subtitle="Manage your organization"
			/>

			<OrganizationStart />
		</div>
	);
}
