import { config } from "@repo/config";
import { getSession } from "@saas/auth/lib/server";
import { ChangeEmailForm } from "@saas/settings/components/ChangeEmailForm";
import { ChangeNameForm } from "@saas/settings/components/ChangeNameForm";
import { UserAvatarForm } from "@saas/settings/components/UserAvatarForm";
import { UserLanguageForm } from "@saas/settings/components/UserLanguageForm";
import { UserTimezoneForm } from "@saas/settings/components/UserTimezoneForm";
import { SettingsList } from "@saas/shared/components/SettingsList";
import { PageContent } from "@saas/studio";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

export async function generateMetadata() {
	const t = await getTranslations();

	return {
		title: t("settings.account.title"),
	};
}

export default async function ProfileSettingsPage() {
	const t = await getTranslations();
	const session = await getSession();

	if (!session) {
		redirect("/auth/login");
	}

	return (
		<PageContent title={t("settings.account.profile.title")}>
			<SettingsList>
				<UserAvatarForm />
				{config.i18n.enabled && <UserLanguageForm />}
				<UserTimezoneForm />
				<ChangeNameForm />
				<ChangeEmailForm />
			</SettingsList>
		</PageContent>
	);
}
