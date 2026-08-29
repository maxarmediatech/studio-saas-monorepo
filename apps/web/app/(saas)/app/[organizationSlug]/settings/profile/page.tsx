import { config } from "@repo/config";
import { getSession } from "@saas/auth/lib/server";
import { ChangeEmailForm } from "@saas/settings/components/ChangeEmailForm";
import { ChangeNameForm } from "@saas/settings/components/ChangeNameForm";
import { UserAvatarForm } from "@saas/settings/components/UserAvatarForm";
import { UserLanguageForm } from "@saas/settings/components/UserLanguageForm";
import { UserTimezoneForm } from "@saas/settings/components/UserTimezoneForm";
import { SettingsList } from "@saas/shared/components/SettingsList";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { SettingsPageFallback } from "../_components/settings-page-fallback";

export const metadata: Metadata = { title: "Account settings" };

export default function ProfileSettingsPage() {
	return (
		<Suspense fallback={<SettingsPageFallback />}>
			<ProfileSettingsContent />
		</Suspense>
	);
}

async function ProfileSettingsContent() {
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
