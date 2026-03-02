import { DeleteOrganizationForm } from "@saas/organizations/components/DeleteOrganizationForm";
import { requireSettingsRouteAccess } from "@saas/settings/lib/server-access";
import { SettingsList } from "@saas/shared/components/SettingsList";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

type Props = {
	params: Promise<{ organizationSlug: string }>;
};

export async function generateMetadata({ params }: Props) {
	const t = await getTranslations();
	const { organizationSlug } = await params;
	const context = await requireSettingsRouteAccess(
		organizationSlug,
		"studioDangerZone",
	);

	return {
		title: `${t("organizations.settings.dangerZone.title")} | ${context?.organization.name ?? "Studio"}`,
	};
}

export default async function OrganizationSettingsPage({ params }: Props) {
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
