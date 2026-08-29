import { config } from "@repo/config";
import { userAccountQueryKey } from "@saas/auth/lib/api";
import { getSession, getUserAccounts } from "@saas/auth/lib/server";
import { ActiveSessionsBlock } from "@saas/settings/components/ActiveSessionsBlock";
import { ChangePasswordForm } from "@saas/settings/components/ChangePassword";
import { ConnectedAccountsBlock } from "@saas/settings/components/ConnectedAccountsBlock";
import { PasskeysBlock } from "@saas/settings/components/PasskeysBlock";
import { SetPasswordForm } from "@saas/settings/components/SetPassword";
import { SettingsList } from "@saas/shared/components/SettingsList";
import { getServerQueryClient } from "@shared/lib/server";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { SettingsPageFallback } from "../_components/settings-page-fallback";

export const metadata: Metadata = { title: "Security" };

export default function SecuritySettingsPage() {
	return (
		<Suspense fallback={<SettingsPageFallback />}>
			<SecuritySettingsContent />
		</Suspense>
	);
}

async function SecuritySettingsContent() {
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
	);
}
