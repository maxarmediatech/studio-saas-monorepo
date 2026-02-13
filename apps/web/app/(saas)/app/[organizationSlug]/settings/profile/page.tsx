import { config } from "@repo/config";
import { getSession } from "@saas/auth/lib/server";
import { ChangeEmailForm } from "@saas/settings/components/ChangeEmailForm";
import { ChangeNameForm } from "@saas/settings/components/ChangeNameForm";
import { UserAvatarForm } from "@saas/settings/components/UserAvatarForm";
import { UserLanguageForm } from "@saas/settings/components/UserLanguageForm";
import { UserTimezoneForm } from "@saas/settings/components/UserTimezoneForm";
import { SettingsList } from "@saas/shared/components/SettingsList";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

export async function generateMetadata() {
	const t = await getTranslations();

	return {
		title: t("settings.account.title"),
	};
}

export default async function ProfileSettingsPage() {
	const session = await getSession();

	if (!session) {
		redirect("/auth/login");
	}

	return (
		<SettingsList>
			<UserAvatarForm />
			<ChangeNameForm />
			<ChangeEmailForm />
			{config.i18n.enabled && <UserLanguageForm />}
			<UserTimezoneForm />
		</SettingsList>
	);
}
