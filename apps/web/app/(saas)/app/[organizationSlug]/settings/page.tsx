import { ChangeOrganizationNameForm } from "@saas/organizations/components/ChangeOrganizationNameForm";
import { OrganizationLogoForm } from "@saas/organizations/components/OrganizationLogoForm";
import { UserTimezoneForm } from "@saas/settings/components/UserTimezoneForm";
import { requireSettingsRouteAccess } from "@saas/settings/lib/server-access";
import { SettingsList } from "@saas/shared/components/SettingsList";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { SettingsPageFallback } from "./_components/settings-page-fallback";

type Props = {
	params: Promise<{ organizationSlug: string }>;
};

export const metadata: Metadata = { title: "General" };

export default function GeneralSettingsPage({ params }: Props) {
	return (
		<Suspense fallback={<SettingsPageFallback />}>
			<GeneralSettingsContent params={params} />
		</Suspense>
	);
}

async function GeneralSettingsContent({ params }: Props) {
	const { organizationSlug } = await params;
	const context = await requireSettingsRouteAccess(
		organizationSlug,
		"general",
	);

	if (!context) {
		return notFound();
	}

	return (
		<SettingsList>
			<OrganizationLogoForm />
			<ChangeOrganizationNameForm />
			<UserTimezoneForm />
		</SettingsList>
	);
}
