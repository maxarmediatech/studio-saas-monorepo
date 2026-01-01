import { isOrganizationAdmin } from "@repo/auth/lib/helper";
import { getActiveOrganization, getSession } from "@saas/auth/lib/server";
import { InviteMemberForm } from "@saas/organizations/components/InviteMemberForm";
import { OrganizationMembersBlock } from "@saas/organizations/components/OrganizationMembersBlock";
import { PageContent } from "@saas/studio";
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
	const session = await getSession();
	const { organizationSlug } = await params;
	const organization = await getActiveOrganization(organizationSlug);

	if (!organization) {
		return notFound();
	}

	return (
		<PageContent title="Members">
			<div className="space-y-6">
				{isOrganizationAdmin(organization, session?.user) && (
					<InviteMemberForm organizationId={organization.id} />
				)}
				<OrganizationMembersBlock organizationId={organization.id} />
			</div>
		</PageContent>
	);
}
