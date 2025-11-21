import { auth } from "@repo/auth";
import { getOrganizationById } from "@repo/database";
import { OrganizationInvitationModal } from "@saas/organizations/components/OrganizationInvitationModal";
import { AuthWrapper } from "@saas/shared/components/AuthWrapper";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

type Props = {
	params: Promise<{ locale: string; invitationId: string }>;
};

export default async function OrganizationInvitationPage({ params }: Props) {
	const { invitationId, locale } = await params;

	const invitation = await auth.api.getInvitation({
		query: {
			id: invitationId,
		},
		headers: await headers(),
	});

	if (!invitation) {
		redirect(`/${locale}`);
	}

	const organization = await getOrganizationById(invitation.organizationId);

	return (
		<AuthWrapper>
			<OrganizationInvitationModal
				organizationName={invitation.organizationName}
				organizationSlug={invitation.organizationSlug}
				logoUrl={organization?.logo || undefined}
				invitationId={invitationId}
			/>
		</AuthWrapper>
	);
}
