import { DeleteAccountForm } from "@saas/settings/components/DeleteAccountForm";
import { SettingsList } from "@saas/shared/components/SettingsList";
import { PageContent } from "@saas/studio";
import { getTranslations } from "next-intl/server";

export async function generateMetadata() {
	const t = await getTranslations();

	return {
		title: t("settings.menu.account.dangerZone"),
	};
}

export default async function AccountDangerZonePage() {
	const t = await getTranslations();

	return (
		<PageContent title={t("settings.menu.account.dangerZone")}>
			<SettingsList>
				<DeleteAccountForm />
			</SettingsList>
		</PageContent>
	);
}
