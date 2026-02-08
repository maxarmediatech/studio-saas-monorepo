import { auth } from "@repo/auth";
import { getOrganizationById } from "@repo/database";
import { resolveAppRedirectPath } from "@saas/auth/lib/redirects";
import { OrganizationInvitationModal } from "@saas/organizations/components/OrganizationInvitationModal";
import { AuthWrapper } from "@saas/shared/components/AuthWrapper";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

type Props = {
	params: Promise<{ invitationId: string }>;
};

export default async function OrganizationInvitationPage({ params }: Props) {
	const { invitationId } = await params;

	const invitation = await auth.api.getInvitation({
		query: {
			id: invitationId,
		},
		headers: await headers(),
	});

	if (!invitation) {
		const activeOrganizationSlug = (await cookies()).get(
			"activeOrganizationSlug",
		)?.value;
		const appRedirectPath = activeOrganizationSlug
			? resolveAppRedirectPath("/app", activeOrganizationSlug)
			: "/app";
		redirect(appRedirectPath);
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
