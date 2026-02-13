import { isOrganizationAdmin } from "@repo/auth/lib/helper";
import { getActiveOrganization, getSession } from "@saas/auth/lib/server";
import { InviteMemberForm } from "@saas/organizations/components/InviteMemberForm";
import { OrganizationInvitationsList } from "@saas/organizations/components/OrganizationInvitationsList";
import { notFound } from "next/navigation";

type Props = {
	params: Promise<{ organizationSlug: string }>;
};

export async function generateMetadata({ params }: Props) {
	const { organizationSlug } = await params;
	const organization = await getActiveOrganization(organizationSlug);

	return {
		title: `Invitations | ${organization?.name ?? "Studio"}`,
	};
}

export default async function InvitationsSettingsPage({ params }: Props) {
	const session = await getSession();
	const { organizationSlug } = await params;
	const organization = await getActiveOrganization(organizationSlug);

	if (!organization) {
		return notFound();
	}

	const isAdmin = isOrganizationAdmin(organization, session?.user);
	if (!isAdmin) {
		return notFound();
	}

	return (
		<div className="space-y-6 px-4 lg:px-6">
			<InviteMemberForm organizationId={organization.id} />
			<OrganizationInvitationsList organizationId={organization.id} />
		</div>
	);
}
