import { requireSettingsRouteAccess } from "@saas/settings/lib/server-access";
import { getOrganizationPageMetadata } from "@saas/studio/lib/organization-page-metadata";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { SettingsPageFallback } from "../_components/settings-page-fallback";
import { RolesPageClient } from "./roles-page-client";

type Props = {
	params: Promise<{ organizationSlug: string }>;
};

export function generateMetadata({ params }: Props) {
	return getOrganizationPageMetadata(params, "Roles");
}

export default function RolesSettingsPage({ params }: Props) {
	return (
		<Suspense fallback={<SettingsPageFallback />}>
			<RolesSettingsContent params={params} />
		</Suspense>
	);
}

async function RolesSettingsContent({ params }: Props) {
	const { organizationSlug } = await params;
	const context = await requireSettingsRouteAccess(organizationSlug, "roles");

	if (!context) {
		return notFound();
	}

	return (
		<div className="px-4 pb-8 lg:px-6">
			<RolesPageClient canManage />
		</div>
	);
}
