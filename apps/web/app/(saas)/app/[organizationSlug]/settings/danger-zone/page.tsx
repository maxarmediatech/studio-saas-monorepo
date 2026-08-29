import { DeleteOrganizationForm } from "@saas/organizations/components/DeleteOrganizationForm";
import { requireSettingsRouteAccess } from "@saas/settings/lib/server-access";
import { SettingsList } from "@saas/shared/components/SettingsList";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { SettingsPageFallback } from "../_components/settings-page-fallback";

type Props = {
	params: Promise<{ organizationSlug: string }>;
};

export const metadata: Metadata = { title: "Danger zone" };

export default function OrganizationSettingsPage({ params }: Props) {
	return (
		<Suspense fallback={<SettingsPageFallback />}>
			<OrganizationSettingsContent params={params} />
		</Suspense>
	);
}

async function OrganizationSettingsContent({ params }: Props) {
	const { organizationSlug } = await params;
	const context = await requireSettingsRouteAccess(
		organizationSlug,
		"studioDangerZone",
	);

	if (!context) {
		return notFound();
	}

	return (
		<SettingsList>
			<DeleteOrganizationForm />
		</SettingsList>
	);
}
