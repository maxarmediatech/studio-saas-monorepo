import { DeleteAccountForm } from "@saas/settings/components/DeleteAccountForm";
import { SettingsList } from "@saas/shared/components/SettingsList";
import { getTranslations } from "next-intl/server";

export async function generateMetadata() {
	const t = await getTranslations();

	return {
		title: t("settings.menu.account.dangerZone"),
	};
}

export default async function AccountDangerZonePage() {
	return (
		<SettingsList>
			<DeleteAccountForm />
		</SettingsList>
	);
}
