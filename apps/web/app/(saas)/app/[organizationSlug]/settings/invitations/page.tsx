import { getActiveOrganization } from "@saas/auth/lib/server";
import { requireSettingsRouteAccess } from "@saas/settings/lib/server-access";
import { notFound } from "next/navigation";
import { InvitationsPageClient } from "./invitations-page-client";

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
	const { organizationSlug } = await params;
	const context = await requireSettingsRouteAccess(
		organizationSlug,
		"invitations",
	);

	if (!context) {
		return notFound();
	}

	return (
		<div className="px-4 pt-6 pb-8 lg:px-6">
			<InvitationsPageClient organizationId={context.organization.id} />
		</div>
	);
}
