import { isOrganizationAdmin } from "@repo/auth/lib/helper";
import { getActiveOrganization, getSession } from "@saas/auth/lib/server";
import { PageContent } from "@saas/studio";
import { notFound } from "next/navigation";
import { RolesList } from "./_components/roles-list";

type Props = {
	params: Promise<{ organizationSlug: string }>;
};

export async function generateMetadata({ params }: Props) {
	const { organizationSlug } = await params;
	const organization = await getActiveOrganization(organizationSlug);

	return {
		title: `Roles | ${organization?.name ?? "Studio"}`,
	};
}

export default async function RolesSettingsPage({ params }: Props) {
	const session = await getSession();
	const { organizationSlug } = await params;
	const organization = await getActiveOrganization(organizationSlug);

	if (!organization) {
		return notFound();
	}

	const isAdmin = isOrganizationAdmin(organization, session?.user);

	return (
		<PageContent title="Roles">
			<RolesList organizationId={organization.id} canManage={isAdmin} />
		</PageContent>
	);
}
