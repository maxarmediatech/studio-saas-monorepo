import { requireSettingsRouteAccess } from "@saas/settings/lib/server-access";
import { getOrganizationPageMetadata } from "@saas/studio/lib/organization-page-metadata";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { SettingsPageFallback } from "../_components/settings-page-fallback";
import { InvitationsPageClient } from "./invitations-page-client";

type Props = {
	params: Promise<{ organizationSlug: string }>;
};

export function generateMetadata({ params }: Props) {
	return getOrganizationPageMetadata(params, "Invitations");
}

export default function InvitationsSettingsPage({ params }: Props) {
	return (
		<Suspense fallback={<SettingsPageFallback />}>
			<InvitationsSettingsContent params={params} />
		</Suspense>
	);
}

async function InvitationsSettingsContent({ params }: Props) {
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
