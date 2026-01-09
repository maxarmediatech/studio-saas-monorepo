import { DeleteOrganizationForm } from "@saas/organizations/components/DeleteOrganizationForm";
import { SettingsList } from "@saas/shared/components/SettingsList";
import { PageContent } from "@saas/studio";
import { getTranslations } from "next-intl/server";

export async function generateMetadata() {
	const t = await getTranslations();

	return {
		title: t("organizations.settings.dangerZone.title"),
	};
}

export default async function OrganizationSettingsPage() {
	const t = await getTranslations();

	return (
		<PageContent title={t("organizations.settings.dangerZone.title")}>
			<SettingsList>
				<DeleteOrganizationForm />
			</SettingsList>
		</PageContent>
	);
}
