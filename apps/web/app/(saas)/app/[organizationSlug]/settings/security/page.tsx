import { config } from "@repo/config";
import { userAccountQueryKey } from "@saas/auth/lib/api";
import { getSession, getUserAccounts } from "@saas/auth/lib/server";
import { ActiveSessionsBlock } from "@saas/settings/components/ActiveSessionsBlock";
import { ChangePasswordForm } from "@saas/settings/components/ChangePassword";
import { ConnectedAccountsBlock } from "@saas/settings/components/ConnectedAccountsBlock";
import { PasskeysBlock } from "@saas/settings/components/PasskeysBlock";
import { SetPasswordForm } from "@saas/settings/components/SetPassword";
import { SettingsList } from "@saas/shared/components/SettingsList";
import { PageContent } from "@saas/studio";
import { getServerQueryClient } from "@shared/lib/server";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

export async function generateMetadata() {
	const t = await getTranslations();

	return {
		title: t("settings.account.security.title"),
	};
}

export default async function SecuritySettingsPage() {
	const t = await getTranslations();
	const session = await getSession();

	if (!session) {
		redirect("/auth/login");
	}

	const userAccounts = await getUserAccounts();

	const userHasPassword = userAccounts?.some(
		(account) => account.providerId === "credential",
	);

	const queryClient = getServerQueryClient();

	await queryClient.prefetchQuery({
		queryKey: userAccountQueryKey,
		queryFn: () => getUserAccounts(),
	});

	return (
		<PageContent title={t("settings.account.security.title")}>
			<SettingsList>
				{config.auth.enablePasswordLogin &&
					(userHasPassword ? (
						<ChangePasswordForm />
					) : (
						<SetPasswordForm />
					))}
				{config.auth.enableSocialLogin && <ConnectedAccountsBlock />}
				{config.auth.enablePasskeys && <PasskeysBlock />}
				<ActiveSessionsBlock />
			</SettingsList>
		</PageContent>
	);
}
