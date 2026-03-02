import { getActiveOrganization } from "@saas/auth/lib/server";
import { ChangeOrganizationNameForm } from "@saas/organizations/components/ChangeOrganizationNameForm";
import { OrganizationLogoForm } from "@saas/organizations/components/OrganizationLogoForm";
import { requireSettingsRouteAccess } from "@saas/settings/lib/server-access";
import { UserTimezoneForm } from "@saas/settings/components/UserTimezoneForm";
import { SettingsList } from "@saas/shared/components/SettingsList";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

type Props = {
	params: Promise<{ organizationSlug: string }>;
};

export async function generateMetadata({ params }: Props) {
	const t = await getTranslations();
	const { organizationSlug } = await params;
	const organization = await getActiveOrganization(organizationSlug);

	return {
		title: `${t("organizations.settings.general.title")} | ${organization?.name ?? "Studio"}`,
	};
}

export default async function GeneralSettingsPage({ params }: Props) {
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
