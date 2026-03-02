import { getVisibleSettingsNavigation } from "@saas/settings/lib/server-access";
import type { PropsWithChildren } from "react";
import { SettingsNav } from "./settings-nav";

type SettingsLayoutProps = PropsWithChildren<{
	params: Promise<{ organizationSlug: string }>;
}>;

export default async function SettingsLayout({
	children,
	params,
}: SettingsLayoutProps) {
	const { organizationSlug } = await params;
	const navigation = await getVisibleSettingsNavigation(organizationSlug);

	return (
		<div className="flex min-h-0 flex-1 flex-col">
			<SettingsNav
				groups={navigation.groups}
				standalonePages={navigation.standalonePages}
			/>
			<div className="min-h-0 flex-1 overflow-y-auto">
				<div className="mx-auto w-full max-w-screen-xl">{children}</div>
			</div>
		</div>
	);
}
